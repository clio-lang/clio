import { test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { verifyLocalWorkflows } from "./helpers/workflow-cli.js";

test("fresh workflow examples run through the source CLI", async () => {
  const directory = await mkdtemp(join(tmpdir(), "kalandra-workflows-"));
  try {
    await verifyLocalWorkflows(resolve("packages/cli/src/index.ts"), directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 30000);
