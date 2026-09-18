/**
 * Safe evaluator for flow step `if:` expressions.
 *
 * Replaces an earlier `eval()` of config text: automation.yml is read by a
 * process holding GITHUB_TOKEN and every secret, so its strings must never
 * reach the JS interpreter. Only comparison, logic and path lookups exist here.
 *
 * Grammar (loosest to tightest binding):
 *   or         := and ( '||' and )*
 *   and        := unary ( '&&' unary )*
 *   unary      := '!' unary | comparison
 *   comparison := primary ( ('=='|'!='|'>='|'<='|'>'|'<') primary )?
 *   primary    := '(' or ')' | literal | path
 *
 * A path is `ident ('.' ident | '[' digits ']')*`, resolved against the scope's
 * own properties. A missing final property is undefined (falsy); a broken
 * intermediate segment, a reserved property name or an unknown root is an
 * error, because silently skipping a step is worse than failing loudly.
 *
 * @packageDocumentation
 */

/** Result of evaluating an `if:` expression. */
export type ExpressionOutcome =
  | { success: true; value: boolean }
  | { success: false; error: string };

/** Property names that must never be reachable from a config expression. */
const FORBIDDEN_SEGMENTS = new Set([
  "__proto__",
  "constructor",
  "prototype",
  "__defineGetter__",
  "__defineSetter__",
  "__lookupGetter__",
  "__lookupSetter__",
]);

const COMPARISON_OPERATORS = new Set(["==", "!=", ">=", "<=", ">", "<"]);

/** Thrown internally with a message that already names the expression. */
class ExpressionSyntaxError extends Error {}

type Token =
  | { kind: "number"; value: number; raw: string }
  | { kind: "string"; value: string; raw: string }
  | { kind: "ident"; value: string; raw: string }
  | { kind: "keyword"; value: "true" | "false"; raw: string }
  | { kind: "operator"; value: string; raw: string }
  | { kind: "punct"; value: string; raw: string };

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  const fail = (at: string): never => {
    throw new ExpressionSyntaxError(`unexpected ${at}`);
  };

  while (i < src.length) {
    const ch = src[i]!;

    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i += 1;
      continue;
    }

    const two = src.slice(i, i + 2);
    if (two === "==" || two === "!=" || two === ">=" || two === "<=" || two === "&&" || two === "||") {
      tokens.push({ kind: "operator", value: two, raw: two });
      i += 2;
      continue;
    }

    if (ch === ">" || ch === "<" || ch === "!") {
      tokens.push({ kind: "operator", value: ch, raw: ch });
      i += 1;
      continue;
    }

    if (ch === "(" || ch === ")" || ch === "." || ch === "[" || ch === "]") {
      tokens.push({ kind: "punct", value: ch, raw: ch });
      i += 1;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const end = src.indexOf(ch, i + 1);
      if (end === -1) fail("unterminated string");
      tokens.push({
        kind: "string",
        value: src.slice(i + 1, end),
        raw: src.slice(i, end + 1),
      });
      i = end + 1;
      continue;
    }

    if (/[0-9]/.test(ch)) {
      const match = /^[0-9]+(\.[0-9]+)?/.exec(src.slice(i));
      const raw = match![0];
      tokens.push({ kind: "number", value: Number(raw), raw });
      i += raw.length;
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      const match = /^[A-Za-z0-9_-]+/.exec(src.slice(i));
      const raw = match![0];
      if (raw === "true" || raw === "false") {
        tokens.push({ kind: "keyword", value: raw, raw });
      } else {
        tokens.push({ kind: "ident", value: raw, raw });
      }
      i += raw.length;
      continue;
    }

    fail(JSON.stringify(ch));
  }

  return tokens;
}

/** A property lookup result: `present` distinguishes undefined-from-missing. */
type Resolved = { present: boolean; value: unknown };

function ownProperty(container: unknown, key: string | number): Resolved {
  if (container === null || typeof container !== "object") {
    return { present: false, value: undefined };
  }
  if (typeof key === "number") {
    if (Array.isArray(container)) {
      return { present: key < container.length, value: container[key] };
    }
    return { present: false, value: undefined };
  }
  if (Object.prototype.hasOwnProperty.call(container, key)) {
    return { present: true, value: (container as Record<string, unknown>)[key] };
  }
  return { present: false, value: undefined };
}

function resolvePath(segments: (string | number)[], scope: Record<string, unknown>): unknown {
  const first = segments[0];
  if (first === undefined) {
    throw new ExpressionSyntaxError("empty reference");
  }
  if (typeof first !== "string") {
    throw new ExpressionSyntaxError("reference must start with a name");
  }
  if (FORBIDDEN_SEGMENTS.has(first)) {
    throw new ExpressionSyntaxError(`cannot read reserved property '${first}'`);
  }

  const root = ownProperty(scope, first);
  if (!root.present) {
    throw new ExpressionSyntaxError(`cannot resolve '${renderPath(segments)}'`);
  }

  let cursor: unknown = root.value;
  let rendered = first;

  for (let i = 1; i < segments.length; i += 1) {
    const segment = segments[i]!;
    rendered += typeof segment === "number" ? `[${segment}]` : `.${segment}`;

    if (typeof segment === "string" && FORBIDDEN_SEGMENTS.has(segment)) {
      throw new ExpressionSyntaxError(`cannot read reserved property in '${rendered}'`);
    }

    // Only the last segment may be absent; a hole mid-path means the reference
    // was written against the wrong shape.
    if (i === segments.length - 1) {
      return ownProperty(cursor, segment).value;
    }

    const step = ownProperty(cursor, segment);
    if (!step.present || step.value === null || typeof step.value !== "object") {
      throw new ExpressionSyntaxError(`cannot resolve '${rendered}'`);
    }
    cursor = step.value;
  }

  return cursor;
}

function renderPath(segments: (string | number)[]): string {
  return segments
    .map((segment, index) =>
      typeof segment === "number" ? `[${segment}]` : index === 0 ? segment : `.${segment}`,
    )
    .join("");
}

/** Parse and evaluate one path, returning its runtime value. */
class Parser {
  private readonly tokens: Token[];
  private position = 0;

  public constructor(src: string, private readonly scope: Record<string, unknown>) {
    this.tokens = tokenize(src);
    if (this.tokens.length === 0) {
      throw new ExpressionSyntaxError("empty expression");
    }
  }

  public parseToEnd(): boolean {
    const value = this.parseOr();
    if (this.position < this.tokens.length) {
      throw new ExpressionSyntaxError(`unexpected '${this.tokens[this.position]!.raw}'`);
    }
    return value;
  }

  private peek(): Token | undefined {
    return this.tokens[this.position];
  }

  private takeIf(kind: Token["kind"], value: string): Token | undefined {
    const token = this.peek();
    if (token !== undefined && token.kind === kind && token.value === value) {
      this.position += 1;
      return token;
    }
    return undefined;
  }

  private parseOr(): boolean {
    let left = this.parseAnd();
    while (this.takeIf("operator", "||") !== undefined) {
      const right = this.parseAnd();
      left = left || right;
    }
    return left;
  }

  private parseAnd(): boolean {
    let left = this.parseUnary();
    while (this.takeIf("operator", "&&") !== undefined) {
      const right = this.parseUnary();
      left = left && right;
    }
    return left;
  }

  private parseUnary(): boolean {
    if (this.takeIf("operator", "!") !== undefined) {
      // `!` binds looser than a comparison so `!a > b` reads as `!(a > b)`.
      return !this.parseUnary();
    }
    return this.parseComparison();
  }

  private parseComparison(): boolean {
    const left = this.parsePrimary();
    const operator = this.peek();
    if (operator?.kind !== "operator" || !COMPARISON_OPERATORS.has(operator.value)) {
      return toBoolean(left);
    }
    this.position += 1;
    const right = this.parsePrimary();
    return compare(operator.value, left, right);
  }

  private parsePrimary(): unknown {
    const token = this.peek();
    if (token === undefined) {
      throw new ExpressionSyntaxError("expression ended early");
    }

    if (token.kind === "punct" && token.value === "(") {
      this.position += 1;
      const inner = this.parseOr();
      if (this.takeIf("punct", ")") === undefined) {
        throw new ExpressionSyntaxError("missing ')'");
      }
      return inner;
    }

    if (token.kind === "number" || token.kind === "string") {
      this.position += 1;
      return token.value;
    }

    if (token.kind === "keyword") {
      this.position += 1;
      return token.value === "true";
    }

    if (token.kind === "ident") {
      this.position += 1;
      return this.parsePathTail([token.value]);
    }

    throw new ExpressionSyntaxError(`unexpected '${token.raw}'`);
  }

  private parsePathTail(segments: (string | number)[]): unknown {
    for (;;) {
      const dot = this.takeIf("punct", ".");
      if (dot !== undefined) {
        const name = this.peek();
        if (name?.kind !== "ident") {
          throw new ExpressionSyntaxError("expected a property name after '.'");
        }
        this.position += 1;
        segments.push(name.value);
        continue;
      }

      const open = this.takeIf("punct", "[");
      if (open !== undefined) {
        const index = this.peek();
        if (index?.kind !== "number" || !Number.isInteger(index.value)) {
          throw new ExpressionSyntaxError("expected an integer index in '[]'");
        }
        this.position += 1;
        if (this.takeIf("punct", "]") === undefined) {
          throw new ExpressionSyntaxError("missing ']'");
        }
        segments.push(index.value);
        continue;
      }

      break;
    }

    return resolvePath(segments, this.scope);
  }
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "string") return value.length > 0;
  return Boolean(value);
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function compare(operator: string, left: unknown, right: unknown): boolean {
  if (operator === "==" || operator === "!=") {
    const equal = valuesEqual(left, right);
    return operator === "==" ? equal : !equal;
  }

  const leftNumber = asNumber(left);
  const rightNumber = asNumber(right);
  if (leftNumber === undefined || rightNumber === undefined) {
    throw new ExpressionSyntaxError(
      `cannot order-compare non-numeric operands (${JSON.stringify(left)} ${operator} ${JSON.stringify(right)})`,
    );
  }

  switch (operator) {
    case ">":
      return leftNumber > rightNumber;
    case "<":
      return leftNumber < rightNumber;
    case ">=":
      return leftNumber >= rightNumber;
    default:
      return leftNumber <= rightNumber;
  }
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (typeof left === "boolean" || typeof right === "boolean") return false;
  const leftNumber = asNumber(left);
  const rightNumber = asNumber(right);
  // Numeric strings from YAML and numbers from plugins must compare equal.
  return leftNumber !== undefined && leftNumber === rightNumber;
}

/**
 * Evaluate an `if:` expression against a scope of names available to a step.
 *
 * @param expr - the expression text from the config
 * @param scope - names resolvable by the expression (github plus step outputs)
 */
export function evaluateExpression(
  expr: string,
  scope: Record<string, unknown>,
): ExpressionOutcome {
  const source = expr.trim();
  try {
    return { success: true, value: new Parser(source, scope).parseToEnd() };
  } catch (err) {
    if (err instanceof ExpressionSyntaxError) {
      return {
        success: false,
        error: `${err.message} in ${JSON.stringify(source)}`,
      };
    }
    return { success: false, error: `failed to evaluate ${JSON.stringify(source)}` };
  }
}
