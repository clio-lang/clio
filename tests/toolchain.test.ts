import { browserDefines } from "../scripts/browser-build-options.js";
import { describe, expect, test } from "bun:test";
import { CstParser, createToken, EOF, Lexer } from "chevrotain";
import { generate } from "@babel/generator";
import * as t from "@babel/types";
import { Sia } from "@timeleap/sia";
import fc from "fast-check";

// This deliberately tiny grammar validates the toolchain, not Kalandra syntax.
const Integer = createToken({ name: "Integer", pattern: /\d+/ });
class ProbeParser extends CstParser {
  readonly literal = this.RULE("literal", () => {
    this.CONSUME(Integer);
    this.CONSUME(EOF);
  });
  constructor() {
    super([Integer]);
    this.performSelfAnalysis();
  }
}

describe("development toolchain", () => {
  test("Chevrotain parses and rejects input under Bun", () => {
    const lexer = new Lexer([Integer], { positionTracking: "onlyOffset" });
    const parser = new ProbeParser();
    parser.input = lexer.tokenize("42").tokens;
    expect(parser.literal().name).toBe("literal");
    expect(parser.errors).toHaveLength(0);
    parser.input = [];
    parser.literal();
    expect(parser.errors.length).toBeGreaterThan(0);
  });

  test("Babel emits executable ESM with original source mappings", async () => {
    const value = t.numericLiteral(42);
    value.loc = {
      start: { line: 1, column: 0, index: 0 },
      end: { line: 1, column: 2, index: 2 },
      filename: "probe.kal",
      identifierName: undefined,
    };
    const result = generate(
      t.program([t.exportDefaultDeclaration(value)]),
      { sourceMaps: true, sourceFileName: "probe.kal" },
      "42",
    );
    const module = await import(
      `data:text/javascript,${encodeURIComponent(result.code)}`
    );
    expect(module.default).toBe(42);
    expect(result.map?.sources).toContain("probe.kal");
    expect(result.map?.mappings.length).toBeGreaterThan(0);
  });

  test("Sia 2.3 round-trips unsigned integers and Unicode strings", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.string(),
        (number, text) => {
          const writer = new Sia();
          writer.addUInt32(number).addString32(text);
          const reader = new Sia();
          reader.setContent(writer.content);
          expect(reader.readUInt32()).toBe(number);
          expect(reader.readString32()).toBe(text);
        },
      ),
      { seed: 20261012, numRuns: 100 },
    );
    const sia = new Sia();
    sia.addString32("Kalandra — Καλημέρα — سلام 🌍").seek(0);
    expect(sia.readString32()).toBe("Kalandra — Καλημέρα — سلام 🌍");
  });

  test("compiler dependencies bundle for browser use", async () => {
    const result = await Bun.build({
      entrypoints: ["tests/fixtures/browser-toolchain.ts"],
      target: "browser",
      define: browserDefines,
      format: "esm",
    });
    expect(result.logs.filter((log) => log.level === "error")).toEqual([]);
    expect(result.success).toBe(true);
    const { mkdtemp, rm } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { pathToFileURL } = await import("node:url");
    const directory = await mkdtemp(join(tmpdir(), "kalandra-browser-"));
    try {
      const path = join(directory, "toolchain.mjs");
      await Bun.write(path, result.outputs[0]!);
      const bundled = await import(pathToFileURL(path).href);
      expect(
        bundled.parse({ path: "browser.kalandra", text: "fn double x: x * 2" })
          .program.body[0].kind,
      ).toBe("FunctionDeclaration");
      expect(
        bundled.analyze({ path: "browser.kalandra", text: 'Number n = "bad"' })
          .diagnostics[0].code,
      ).toBe("KAL3111");
      const compilation = bundled.compile({
        path: "browser.kalandra",
        text: "export fn double x: x * 2\nexport fn mapped: 0..3 -> * double",
      });
      expect(compilation.diagnostics).toEqual([]);
      const compiledPath = join(directory, "compiled.mjs");
      await Bun.write(compiledPath, compilation.output.code);
      const executed = await import(pathToFileURL(compiledPath).href);
      expect(executed.double(21)).toBe(42);
      expect([...executed.mapped()]).toEqual([0, 2, 4]);
      const sources: Record<string, string> = {
        "main.kalandra": 'from "./value" import answer\nexport answer',
        "value.kalandra": "export answer = 42",
      };
      const project = await bundled.compileProject(
        "main.kalandra",
        {
          async readSource(path: string) {
            return sources[path] ?? null;
          },
        },
        { strictNames: true },
      );
      expect(project.diagnostics).toEqual([]);
      expect(project.output.files.has("main.kalandra.mjs")).toBe(true);
      let reply: (message: unknown) => void = () => {};
      const pool = new bundled.WorkerPool(
        {
          createWorker() {
            return {
              subscribe(callback: typeof reply) {
                reply = callback;
                return () => {};
              },
              send(request: { id: number }) {
                reply({ kind: "result", id: request.id, value: 42 });
              },
              async terminate() {},
            };
          },
          schedule() {
            return () => {};
          },
        },
        { maxWorkers: 1, maxQueuedTasks: 0 },
      );
      expect(
        await pool.run({ module: "test", exportName: "f", args: [] }),
      ).toBe(42);
      await pool.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
