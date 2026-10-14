import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { verifyNewCli } from "../tests/helpers/new-cli.js";
import { verifyWatchCli } from "../tests/helpers/watch-cli.js";
import { verifyLanguageServer } from "../tests/helpers/lsp-client.js";
import { verifyRemoteBuildCli } from "../tests/helpers/remote-build-cli.js";

const { version: expectedVersion } = await Bun.file(
  new URL("../package.json", import.meta.url),
).json();
const registry = process.argv[2] === "--registry";
const archive = resolve(
  process.argv[2] ?? `dist/release/kalandra-cli-${expectedVersion}.tgz`,
);
const directory = await mkdtemp(join(tmpdir(), "kalandra-release-"));
try {
  await Bun.write(
    join(directory, "package.json"),
    JSON.stringify({
      private: true,
      dependencies: {
        "@kalandra/cli": registry ? expectedVersion : `file:${archive}`,
      },
    }),
  );
  const install = Bun.spawn([process.execPath, "install", "--ignore-scripts"], {
    cwd: directory,
    stdout: "inherit",
    stderr: "inherit",
  });
  assert.equal(await install.exited, 0, "Clean release install failed");
  const cli = join(directory, "node_modules/.bin/kalandra");
  const version = Bun.spawnSync([cli, "--version"], { cwd: directory });
  assert.equal(version.exitCode, 0, version.stderr.toString());
  assert.equal(
    version.stdout.toString().trim(),
    `kalandra ${expectedVersion} (development)`,
  );
  const root = join(directory, "node_modules/@kalandra/cli");
  const manifest = await Bun.file(join(root, "package.json")).json();
  assert.equal(manifest.private, undefined);
  assert.equal(manifest.dependencies, undefined);
  assert.ok(await Bun.file(join(root, "THIRD_PARTY_NOTICES.txt")).exists());
  await verifyNewCli(cli, directory);
  await verifyWatchCli(cli, directory);
  await verifyRemoteBuildCli(cli, directory);
  await verifyLanguageServer(
    join(directory, "node_modules/.bin/kalandra-lsp"),
    directory,
  );
  console.log(
    "npm release passes clean installation, executable bins, scaffolding, parallel run/build, watch, remote build, and language-server checks.",
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
