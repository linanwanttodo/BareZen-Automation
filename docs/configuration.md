# Configuration Reference

Complete reference for `automation.yml` — the BareZen Automation configuration file.

## Top-Level Structure

```yaml
plugins:          # List of plugin names to load (required, at least 1)
  - rss
  - telegram

flows:            # Flow definitions (required)
  daily-report:
    - plugin: rss
      inputs: { ... }
      output: news

settings:         # Global settings (optional)
  defaultTimeout: 60000
  logLevel: info
```

## `plugins`

Array of plugin names. Plugins are loaded from the plugins directory (default: `plugins/`).

```yaml
plugins:
  - rss
  - email
  - ai-summary
```

## `flows`

Map of flow name to step array. Each flow is a sequence of plugin executions.

```yaml
flows:
  daily-report:           # Flow name
    - plugin: rss         # Step 1
      inputs:
        url: https://example.com/feed.xml
      output: news        # Output key (stored in flow context)

    - plugin: text-template
      input: { vars: news }          # Bind the whole previous output to `vars`
      inputs:
        template: |
          {{#each articles}}- {{title}}
          {{/each}}
      output: digest

    - plugin: email       # Step 3
      input: { body: digest.text }   # Field path into an earlier step
      inputs:
        to: user@example.com
        subject: Daily Report
```

## Step Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `plugin` | string | Yes | Plugin name |
| `inputs` | object | No | Direct input values |
| `input` | string \| object | No | Bind a previous step's output to inputs; accepts field paths |
| `output` | string | No | Store output in flow context under this key |
| `if` | string | No | Condition expression (e.g., `true`, `false`) |
| `continueOnError` | boolean | No | Continue to next step if this one fails (default: `false`) |
| `retry` | object | No | Retry configuration |
| `timeout` | number | No | Timeout in milliseconds |

## Referencing Earlier Output

`input` addresses values stored by an earlier step's `output`:

```yaml
input: news                      # binds the whole output to a parameter named `input`
input: { body: news }            # binds the whole output to `body`
input: { body: news.digest }     # field path: a nested value
input: { body: news.items[0].title }   # list index, then field
```

Paths resolve against the previous outputs only; there is no expression
language, arithmetic, or fallback syntax. `inputs` and `input` may appear on
the same step, and `input` wins on a key collision. Because every step output
is an object, rendering a list into a string is the `text-template` plugin's
job.

## `retry` Configuration

```yaml
- plugin: fetch-api
  retry:
    attempts: 3
    delay: 1000        # Delay between retries in ms
    backoff: exponential  # exponential | linear | fixed
```

## `settings`

Global settings applied to all flows.

```yaml
settings:
  defaultTimeout: 60000    # Default timeout in ms (default: 60000)
  logLevel: info           # debug | info | warn | error (default: info)
```

## Secret References

Use `${{ secrets.NAME }}` syntax to reference GitHub Actions secrets:

```yaml
flows:
  notify:
    - plugin: telegram
      inputs:
        chatId: ${{ secrets.TELEGRAM_CHAT_ID }}
        message: "Deployment complete"
        botToken: ${{ secrets.TELEGRAM_BOT_TOKEN }}
```

Secrets are resolved recursively in strings, arrays, and objects. Resolved values are masked in logs.

## Condition Expressions

`if` is evaluated by a small parser, not by JavaScript. Supported:

| Form | Example |
|------|---------|
| literals | `true`, `false`, `42`, `"push"` |
| comparison | `==`, `!=`, `>`, `>=`, `<`, `<=` |
| logic | `&&`, `\|\|`, `!`, parentheses |
| reference | `github.ref`, `news.count`, `news.articles[0].title` |

A reference resolves against the `github` context plus every output stored by an
earlier step in the same flow:

```yaml
- plugin: deploy
  if: github.eventName == "push" && github.ref == "refs/heads/main"

- plugin: notify
  if: news.count > 5              # from an earlier step's `output: news`

- plugin: summarise
  if: digest.text                  # truthy: non-empty string, non-zero number

- plugin: audit
  if: !github.official             # anything absent reads as false
```

`==` and `!=` treat a numeric string and a number as equal, because YAML may
type the same value either way (`"7" == 7` is true). Ordering comparisons
require both sides to be numeric or the step fails.

Two distinct outcomes, deliberately:

- **false expression** → the step is skipped and the flow continues.
- **unparseable expression** → the step fails with `Invalid 'if' expression: ...`
  and the flow aborts (unless `continueOnError`), because a typo that silently
  skips work is worse than one that stops the run.

Property access is limited to an object's own fields: `__proto__`,
`constructor` and similar are rejected, and no function call, assignment or
member of the JavaScript runtime is reachable from an expression.

## Complete Example

```yaml
plugins:
  - rss
  - text-template
  - ai-summary
  - email
  - telegram

flows:
  daily-digest:
    - plugin: rss
      inputs:
        url: https://blog.example.com/feed.xml
        limit: 20
      output: articles

    - plugin: text-template
      input: { vars: articles }
      inputs:
        template: |
          {{#each articles}}- {{title}}
          {{/each}}
      output: digest

    - plugin: ai-summary
      input: { text: digest.text }
      inputs:
        model: gpt-4o-mini
      output: summary

    - plugin: email
      input: { body: summary.text }
      inputs:
        to: team@example.com
        subject: Daily Digest
      continueOnError: true

    - plugin: telegram
      inputs:
        chatId: ${{ secrets.TELEGRAM_CHAT_ID }}
        message: "Daily digest sent"
      if: summary.text

  weekly-report:
    - plugin: rss
      inputs:
        url: https://blog.example.com/feed.xml
        limit: 50
      output: weekly-articles
      retry:
        attempts: 3
        delay: 2000

settings:
  defaultTimeout: 120000
  logLevel: debug
```

## Invalid Config Examples

### Empty plugins array

```yaml
plugins: []        # Error: must have at least 1 plugin
flows: {}
```

### Missing flows

```yaml
plugins:
  - rss
# Error: flows is required
```

### Invalid step (no plugin)

```yaml
plugins:
  - rss
flows:
  test:
    - inputs: { url: "https://example.com" }   # Error: plugin is required
```
