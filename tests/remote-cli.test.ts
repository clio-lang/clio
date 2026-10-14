import { expect, test } from "bun:test";
import {
  environmentToken,
  parseBindings,
  serveOptions,
} from "../packages/cli/src/remote.js";

const token = "a".repeat(32);
test("remote CLI resolves environment references without storing tokens in binding files", () => {
  const text = JSON.stringify({
    version: 1,
    endpoints: {
      "math.client.json": {
        url: "http://127.0.0.1:3000",
        tokenEnv: "MATH_TOKEN",
      },
    },
  });
  expect(
    parseBindings(text, { MATH_TOKEN: token }).get("math.client.json")?.token,
  ).toBe(token);
  expect(text).not.toContain(token);
  expect(() =>
    environmentToken("MATH_TOKEN", { MATH_TOKEN: "secret" }),
  ).toThrow("MATH_TOKEN");
});

test("remote CLI rejects ambiguous or unsafe configuration", () => {
  for (const endpoints of [
    { "../contract.json": { url: "http://127.0.0.1", tokenEnv: "TOKEN" } },
    { "contract.json": { url: "http://127.0.0.1", token: token } },
    {
      "contract.json": {
        url: "http://127.0.0.1",
        tokenEnv: "TOKEN",
        extra: true,
      },
    },
    {},
  ])
    expect(() =>
      parseBindings(JSON.stringify({ version: 1, endpoints }), {
        TOKEN: token,
      }),
    ).toThrow();
  expect(() => parseBindings("{secret")).toThrow(
    "Invalid endpoint bindings JSON",
  );
  expect(() => environmentToken("bad-name", {})).toThrow();
  expect(() => serveOptions(["--port", "1.5"])).toThrow();
  expect(() => serveOptions(["--port", "1", "--port", "2"])).toThrow();
  expect(() => serveOptions(["--max-concurrent", "65"])).toThrow();
  expect(() => serveOptions(["--token", token])).toThrow();
  expect(serveOptions(["--port", "0", "--token-env", "TOKEN"]).port).toBe(0);
});

test("serve fails before opening a listener when its environment token is absent", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      "packages/cli/src/index.ts",
      "serve",
      "missing.json",
      "--token-env",
      "KALANDRA_TEST_MISSING_TOKEN",
    ],
    { env: {} },
  );
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("KALANDRA_TEST_MISSING_TOKEN");
  const unknown = Bun.spawnSync([
    process.execPath,
    "packages/cli/src/index.ts",
    "run",
    "test.kalandra",
    "--token",
    token,
  ]);
  expect(unknown.exitCode).toBe(1);
  expect(unknown.stderr.toString()).not.toContain(token);
});
