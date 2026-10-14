import { verifyNewCli } from "../tests/helpers/new-cli.js";
import { verifyHighlightCli } from "../tests/helpers/highlight-cli.js";
import { verifyDocsCli } from "../tests/helpers/docs-cli.js";
import { verifyAssetsCli } from "../tests/helpers/assets-cli.js";
import { verifyLocalWorkflows } from "../tests/helpers/workflow-cli.js";
import { verifyRemoteBuildCli } from "../tests/helpers/remote-build-cli.js";
import { verifyAcceptanceCli } from "../tests/helpers/acceptance-cli.js";
import { verifyFormatCli } from "../tests/helpers/format-cli.js";
import {
  verifyWatchCli,
  verifyWatchMetadata,
} from "../tests/helpers/watch-cli.js";
import { verifyExternalTypesCli } from "../tests/helpers/external-types-cli.js";
import { verifyInstallCli } from "../tests/helpers/install-cli.js";
import { verifyProjectRootCli } from "../tests/helpers/project-root-cli.js";
import { verifyLanguageServer } from "../tests/helpers/lsp-client.js";
import assert from "node:assert/strict";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Exercise actual artifacts without workspace node_modules or TypeScript exports.
const directory = await mkdtemp(join(tmpdir(), "kalandra-built-cli-"));
try {
  await cp("dist", join(directory, "dist"), { recursive: true });
  await verifyLocalWorkflows(join(directory, "dist/cli/index.js"), directory);
  await verifyLanguageServer(
    join(directory, "dist/language-server/stdio.js"),
    directory,
  );
  await verifyNewCli(join(directory, "dist/cli/index.js"), directory);
  await verifyHighlightCli(join(directory, "dist/cli/index.js"), directory);
  await verifyDocsCli(join(directory, "dist/cli/index.js"), directory);
  await verifyAssetsCli(join(directory, "dist/cli/index.js"), directory);
  await verifyFormatCli(join(directory, "dist/cli/index.js"), directory);
  await verifyRemoteBuildCli(join(directory, "dist/cli/index.js"), directory);
  await verifyWatchCli(join(directory, "dist/cli/index.js"), directory);
  await verifyWatchMetadata(join(directory, "dist/cli/index.js"), directory);
  await verifyExternalTypesCli(join(directory, "dist/cli/index.js"), directory);
  await verifyInstallCli(join(directory, "dist/cli/index.js"), directory);
  await verifyProjectRootCli(join(directory, "dist/cli/index.js"), directory);
  await verifyAcceptanceCli(
    join(directory, "dist/cli/index.js"),
    directory,
    resolve("tests/fixtures/acceptance"),
  );
  const source = join(directory, "main.kalandra");
  const run = () =>
    Bun.spawnSync(
      [
        process.execPath,
        join(directory, "dist/cli/index.js"),
        "run",
        source,
        "--strict",
      ],
      { cwd: directory },
    );
  await Bun.write(
    source,
    await Bun.file("examples/local-events.kalandra").text(),
  );
  const localEvents = run();
  assert.equal(localEvents.exitCode, 0, localEvents.stderr.toString());
  assert.deepEqual(JSON.parse(localEvents.stdout.toString()), [6, 14]);
  await Bun.write(
    source,
    await Bun.file("examples/startup-closure.kalandra").text(),
  );
  const startupClosure = run();
  assert.equal(startupClosure.exitCode, 0, startupClosure.stderr.toString());
  assert.deepEqual(JSON.parse(startupClosure.stdout.toString()), [6, 6, 7]);
  const decoratedProbe = await Bun.file(
    "tests/fixtures/clio/port-probes/decorated-tail.json",
  ).json();
  await Bun.write(
    source,
    decoratedProbe.source + "\nexport fn main: sum 100000 0\n",
  );
  const decoratedTail = run();
  assert.equal(decoratedTail.exitCode, 0, decoratedTail.stderr.toString());
  assert.equal(
    JSON.parse(decoratedTail.stdout.toString()),
    decoratedProbe.results.sum,
  );
  await Bun.write(
    source,
    await Bun.file("examples/async-tail-recursion.kalandra").text(),
  );
  const asyncTail = run();
  assert.equal(asyncTail.exitCode, 0, asyncTail.stderr.toString());
  assert.equal(JSON.parse(asyncTail.stdout.toString()), 5000050000);
  await cp("examples/packages/.kalandra", join(directory, ".kalandra"), {
    recursive: true,
  });
  await Bun.write(
    source,
    await Bun.file("examples/packages/main.kalandra").text(),
  );
  const clioPackage = run();
  assert.equal(clioPackage.exitCode, 0, clioPackage.stderr.toString());
  assert.equal(JSON.parse(clioPackage.stdout.toString()), 42);
  await Bun.write(source, await Bun.file("examples/parallel.kalandra").text());
  const success = run();
  assert.equal(success.exitCode, 0, success.stderr.toString());
  assert.deepEqual(
    JSON.parse(success.stdout.toString()),
    [6765, 10946, 17711, 28657],
  );
  await Bun.write(
    source,
    await Bun.file("examples/parallel-modules/main.kalandra").text(),
  );
  await Bun.write(
    join(directory, "tasks.kalandra"),
    await Bun.file("examples/parallel-modules/tasks.kalandra").text(),
  );
  await Bun.write(
    join(directory, "math.kalandra"),
    await Bun.file("examples/parallel-modules/math.kalandra").text(),
  );
  const imported = run();
  assert.equal(imported.exitCode, 0, imported.stderr.toString());
  assert.deepEqual(
    JSON.parse(imported.stdout.toString()),
    [6765, 10946, 17711, 28657],
  );
  await cp("examples/parallel-records", join(directory, "records"), {
    recursive: true,
  });
  await Bun.write(source, 'from "./records/main" import main\nexport main');
  const records = run();
  assert.equal(records.exitCode, 0, records.stderr.toString());
  assert.equal(JSON.parse(records.stdout.toString()), 8);
  await cp("examples/parallel-captures", join(directory, "captures"), {
    recursive: true,
  });
  await Bun.write(source, 'from "./captures/main" import main\nexport main');
  const captures = run();
  assert.equal(captures.exitCode, 0, captures.stderr.toString());
  assert.deepEqual(JSON.parse(captures.stdout.toString()), [4, 6, 8]);
  await Bun.write(
    source,
    await Bun.file("examples/nested-parallel.kalandra").text(),
  );
  const nested = run();
  assert.equal(nested.exitCode, 0, nested.stderr.toString());
  assert.deepEqual(JSON.parse(nested.stdout.toString()), [
    [2, 4],
    [6, 8],
  ]);
  await Bun.write(
    source,
    await Bun.file("examples/indexed-assignment.kalandra").text(),
  );
  const indexed = run();
  assert.equal(indexed.exitCode, 0, indexed.stderr.toString());
  assert.deepEqual(JSON.parse(indexed.stdout.toString()), [2, 42]);
  await Bun.write(
    source,
    await Bun.file("examples/tail-recursion.kalandra").text(),
  );
  const tailRecursive = run();
  assert.equal(tailRecursive.exitCode, 0, tailRecursive.stderr.toString());
  assert.equal(JSON.parse(tailRecursive.stdout.toString()), 5000050000);
  await Bun.write(
    source,
    await Bun.file("examples/expression-bindings.kalandra").text(),
  );
  const expressionBindings = run();
  assert.equal(
    expressionBindings.exitCode,
    0,
    expressionBindings.stderr.toString(),
  );
  assert.deepEqual(
    JSON.parse(expressionBindings.stdout.toString()),
    [14, 6, 8],
  );
  await Bun.write(
    source,
    "@params Number\nfn bad n:\n  n.missing ()\n  n\nexport fn main: await |bad| 1",
  );
  const failure = run();
  assert.equal(failure.exitCode, 1);
  assert.match(failure.stderr.toString(), /Cannot run program/);
  console.log(
    "Built CLI, language server, and Bun workers pass outside the workspace (success and failure cleanup).",
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
