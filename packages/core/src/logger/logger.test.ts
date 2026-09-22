import { describe, expect, it } from "vitest";
import { type ConsoleSink, createLogger, silentLogger } from "./logger.js";

/** Capturing sink for tests. */
function makeCapturingSink(): ConsoleSink & {
  records: { level: string; msg: string }[];
  groups: { open: string[]; close: number };
} {
  const records: { level: string; msg: string }[] = [];
  const groups = { open: [] as string[], close: 0 };
  return {
    records,
    groups,
    debug: (msg) => records.push({ level: "debug", msg }),
    info: (msg) => records.push({ level: "info", msg }),
    warn: (msg) => records.push({ level: "warn", msg }),
    error: (msg) => records.push({ level: "error", msg }),
    group: (name) => groups.open.push(name),
    groupEnd: () => {
      groups.close += 1;
    },
  };
}

describe("Logger", () => {
  describe("level filtering", () => {
    it("emits info and above by default", () => {
      const sink = makeCapturingSink();
      const log = createLogger({ sink });
      log.debug("d");
      log.info("i");
      log.warn("w");
      log.error("e");
      expect(sink.records.map((r) => r.level)).toEqual(["info", "warn", "error"]);
    });

    it("emits all at debug level", () => {
      const sink = makeCapturingSink();
      const log = createLogger({ level: "debug", sink });
      log.debug("d");
      log.info("i");
      log.warn("w");
      log.error("e");
      expect(sink.records.map((r) => r.level)).toEqual(["debug", "info", "warn", "error"]);
    });

    it("emits only error at error level", () => {
      const sink = makeCapturingSink();
      const log = createLogger({ level: "error", sink });
      log.info("i");
      log.warn("w");
      log.error("e");
      expect(sink.records.map((r) => r.level)).toEqual(["error"]);
    });
  });

  describe("scope prefix", () => {
    it("prepends scope to messages", () => {
      const sink = makeCapturingSink();
      const log = createLogger({ scope: "rss", sink });
      log.info("fetching");
      expect(sink.records[0]?.msg).toBe("[rss] fetching");
    });

    it("appends metadata as JSON", () => {
      const sink = makeCapturingSink();
      const log = createLogger({ scope: "rss", sink });
      log.info("fetched", { count: 3 });
      expect(sink.records[0]?.msg).toBe('[rss] fetched {"count":3}');
    });

    it("omits metadata suffix when meta is empty", () => {
      const sink = makeCapturingSink();
      const log = createLogger({ scope: "rss", sink });
      log.info("fetched", {});
      expect(sink.records[0]?.msg).toBe("[rss] fetched");
    });
  });

  describe("child logger", () => {
    it("concatenates scopes with colon", () => {
      const sink = makeCapturingSink();
      const log = createLogger({ scope: "rss", sink });
      const child = log.child("parser");
      child.info("parse");
      expect(sink.records[0]?.msg).toBe("[rss:parser] parse");
    });

    it("child of root uses child scope directly", () => {
      const sink = makeCapturingSink();
      const log = createLogger({ sink });
      const child = log.child("rss");
      child.info("x");
      expect(sink.records[0]?.msg).toBe("[rss] x");
    });

    it("child inherits level", () => {
      const sink = makeCapturingSink();
      const log = createLogger({ level: "warn", sink });
      const child = log.child("rss");
      child.info("should be filtered");
      child.warn("should pass");
      expect(sink.records.map((r) => r.msg)).toEqual(["[rss] should pass"]);
    });
  });

  describe("group / groupEnd", () => {
    it("forwards group open and close to sink", () => {
      const sink = makeCapturingSink();
      const log = createLogger({ sink });
      log.group("phase-1");
      log.info("working");
      log.groupEnd();
      expect(sink.groups.open).toEqual(["phase-1"]);
      expect(sink.groups.close).toBe(1);
    });

    it("group name includes scope prefix", () => {
      const sink = makeCapturingSink();
      const log = createLogger({ scope: "flow", sink });
      log.group("daily-report");
      expect(sink.groups.open).toEqual(["[flow] daily-report"]);
    });
  });

  describe("silentLogger", () => {
    it("discards all output without throwing", () => {
      expect(() => {
        silentLogger.debug("d");
        silentLogger.info("i");
        silentLogger.warn("w");
        silentLogger.error("e");
        silentLogger.group("g");
        silentLogger.groupEnd();
        const child = silentLogger.child("x");
        child.info("c");
      }).not.toThrow();
    });
  });

  describe("environment detection", () => {
    it("uses provided sink when explicitly given (sink takes precedence)", () => {
      const sink = makeCapturingSink();
      const log = createLogger({ forceActionsEnv: true, sink });
      log.info("test");
      expect(sink.records).toHaveLength(1);
      expect(sink.records[0]?.msg).toBe("test");
    });

    it("falls back to actions sink when in Actions env and no sink provided", () => {
      // No capturing sink; verify no throw and no console capture.
      const log = createLogger({ forceActionsEnv: true });
      expect(() => log.info("via actions core")).not.toThrow();
    });
  });

  describe("redaction", () => {
    const redact = (text: string) => text.replaceAll("s3cr3t", "***");

    it("scrubs the message", () => {
      const sink = makeCapturingSink();
      createLogger({ sink, redact }).info("token is s3cr3t");
      expect(sink.records[0]?.msg).toBe("token is ***");
    });

    it("scrubs serialized metadata too", () => {
      const sink = makeCapturingSink();
      createLogger({ sink, redact }).warn("failed", { headers: "s3cr3t" });
      expect(sink.records[0]?.msg).not.toContain("s3cr3t");
      expect(sink.records[0]?.msg).toContain("***");
    });

    it("applies on child loggers", () => {
      const sink = makeCapturingSink();
      createLogger({ sink, redact, scope: "root" })
        .child("step")
        .error("child saw s3cr3t");
      expect(sink.records[0]?.msg).toBe("[root:step] child saw ***");
    });
  });
});
