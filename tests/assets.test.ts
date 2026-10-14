import { test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { verifyAssetsCli } from "./helpers/assets-cli.js";

test("CLI copies binary assets safely and watches additions, edits and removals", async () => {
  const directory = await mkdtemp(join(tmpdir(), "kalandra-assets-"));
  try {
    await verifyAssetsCli(resolve("packages/cli/src/index.ts"), directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 20000);
