import { test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import {
  acceptanceCases,
  verifyAcceptanceCase,
} from "./helpers/acceptance-cli.js";

for (const scenario of acceptanceCases) {
  test(`fresh project acceptance: ${scenario.name}`, async () => {
    const root = await mkdtemp(join(tmpdir(), "kalandra-acceptance-"));
    try {
      await verifyAcceptanceCase(
        resolve("packages/cli/src/index.ts"),
        root,
        resolve("tests/fixtures/acceptance"),
        scenario,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 35000);
}
