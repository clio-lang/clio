import { test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { verifyNewCli } from "./helpers/new-cli.js";

test("offline starter runs and builds without Git or package tools, refusing existing paths", async () => {
  const directory = await mkdtemp(join(tmpdir(), "kalandra-new-"));
  try {
    await verifyNewCli(resolve("packages/cli/src/index.ts"), directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
