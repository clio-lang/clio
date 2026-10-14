import { expect, test } from "bun:test";
import { mkdtemp, rm, rename, symlink, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  startWatch,
  verifyWatchCli,
  verifyWatchMetadata,
} from "./helpers/watch-cli.js";
import { externalPackage } from "./helpers/external-types-cli.js";
const cli = resolve("packages/cli/src/index.ts");
async function fixture(action: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "kalandra-watch-test-"));
  try {
    await action(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
test(
  "watch rebuilds changing graphs, preserves successful output on errors, and ignores generated files",
  () => fixture((root) => verifyWatchCli(cli, root)),
  20000,
);
test(
  "watch recovers from missing JavaScript packages and refreshes declarations and entry resolution",
  () => fixture((root) => verifyWatchMetadata(cli, root)),
  20000,
);
test(
  "watch finishes its active build before shutdown",
  () =>
    fixture(async (root) => {
      const main = join(root, "main.kalandra");
      await Bun.write(main, "export fn main: 42");
      const watch = startWatch(cli, main, join(root, "out"));
      try {
        await watch.until(() => watch.count("Watch: building") === 1);
        await watch.stop();
        expect(watch.count("Watch: build succeeded")).toBe(1);
        expect(
          await Bun.file(join(root, "out/main.kalandra.mjs")).exists(),
        ).toBe(true);
      } finally {
        if (watch.child.exitCode === null) {
          watch.child.kill("SIGKILL");
          await watch.child.exited;
        }
      }
    }),
  15000,
);
test("watch is accepted only by build, once, with an explicit output", () => {
  for (const args of [
    ["run", "main.kalandra", "--watch"],
    ["build", "main.kalandra", "--watch"],
    ["build", "main.kalandra", "-o", "out", "--watch", "--watch"],
  ]) {
    expect(Bun.spawnSync([process.execPath, cli, ...args]).exitCode).toBe(1);
  }
});

test(
  "watch follows a repointed JavaScript package symlink even when metadata is unchanged",
  () =>
    fixture(async (root) => {
      const pkg = await externalPackage(root);
      const first = join(root, "version-one"),
        second = join(root, "version-two");
      await rename(pkg, first);
      await cp(first, second, { recursive: true });
      await symlink(first, pkg);
      const main = join(root, "main.kalandra"),
        output = join(root, "out");
      await Bun.write(
        main,
        'from "esm:typed-lib" import make\nexport fn main: make 1',
      );
      const watch = startWatch(cli, main, output);
      try {
        await watch.until(() => watch.count("Watch: build succeeded") === 1);
        expect(
          await Bun.file(join(output, "main.kalandra.mjs")).text(),
        ).toContain("version-one");
        await rm(pkg);
        await symlink(second, pkg);
        await watch.until(() => watch.count("Watch: build succeeded") === 2);
        expect(
          await Bun.file(join(output, "main.kalandra.mjs")).text(),
        ).toContain("version-two");
        await watch.stop();
      } finally {
        if (watch.child.exitCode === null) {
          watch.child.kill("SIGKILL");
          await watch.child.exited;
        }
      }
    }),
  15000,
);
