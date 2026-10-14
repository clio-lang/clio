import assert from "node:assert/strict";
import { cp, access } from "node:fs/promises";
import { join } from "node:path";

export const acceptanceCases = [
  { name: "records-and-closures", result: [9, 8] },
  { name: "async-pipeline", result: [6.5, 10.5] },
  {
    name: "nested-captures",
    result: [
      [4, 6],
      [8, 10],
    ],
  },
  { name: "worker-failure", runtimeError: "missing is not a function" },
  { name: "dynamic-boundary", diagnostic: "KAL4202" },
  { name: "imported-type-error", diagnostic: "KAL3106" },
] as const;

/** Run complete, fresh projects through the CLI outside the workspace. */
export async function verifyAcceptanceCase(
  cli: string,
  directory: string,
  fixtures: string,
  scenario: (typeof acceptanceCases)[number],
) {
  const project = join(directory, scenario.name);
  await cp(join(fixtures, scenario.name), project, { recursive: true });
  const invoke = (...args: string[]) => {
    const child = Bun.spawnSync([process.execPath, cli, ...args], {
      cwd: join(project, "src"),
      timeout: 15000,
    });
    assert.ok(child.signalCode == null, "acceptance CLI must exit normally");
    return child;
  };
  const built = invoke("build", "main.kalandra", "--strict", "-o", "../output");
  if ("diagnostic" in scenario) {
    assert.equal(built.exitCode, 1);
    assert.match(built.stderr.toString(), new RegExp(scenario.diagnostic));
    assert.equal(built.stdout.toString(), "");
    await assert.rejects(access(join(project, "output")));
  } else {
    assert.equal(built.exitCode, 0, built.stderr.toString());
    await access(join(project, "output/main.kalandra.mjs"));
  }
  const ran = invoke("run", "main.kalandra", "--strict");
  if ("result" in scenario) {
    assert.equal(ran.exitCode, 0, ran.stderr.toString());
    assert.equal(ran.stderr.toString(), "");
    assert.deepEqual(JSON.parse(ran.stdout.toString()), scenario.result);
  } else {
    assert.equal(ran.exitCode, 1);
    assert.equal(ran.stdout.toString(), "");
    assert.ok(
      ran.stderr
        .toString()
        .includes(
          "diagnostic" in scenario
            ? scenario.diagnostic
            : scenario.runtimeError,
        ),
      ran.stderr.toString(),
    );
  }
}

export async function verifyAcceptanceCli(
  cli: string,
  directory: string,
  fixtures: string,
) {
  for (const scenario of acceptanceCases)
    await verifyAcceptanceCase(cli, directory, fixtures, scenario);
}
