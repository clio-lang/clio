import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export async function verifyRemoteBuildCli(cli: string, directory: string) {
  const root = join(directory, "remote-build");
  await mkdir(root, { recursive: true });
  const source = join(root, "services.kalandra");
  const output = join(root, "out");
  await Bun.write(
    source,
    "@params Number\n@returns Number\nexport fn double n: n * 2\n1.missing ()",
  );
  const run = (...flags: string[]) =>
    Bun.spawnSync(
      [
        process.execPath,
        resolve(cli),
        "build",
        source,
        "-o",
        output,
        "--strict",
        ...flags,
      ],
      { cwd: directory },
    );
  const good = run("--service", "calculate=double");
  assert.equal(good.exitCode, 0, good.stderr.toString());
  const serverPath = join(output, "kalandra.deployment.json");
  const clientPath = join(output, "kalandra.client.json");
  const saved = await readFile(serverPath, "utf8");
  const server = JSON.parse(saved);
  const client = JSON.parse(await readFile(clientPath, "utf8"));
  assert.equal(server.revision, client.revision);
  assert.deepEqual(Object.keys(server.services), ["calculate"]);
  assert.deepEqual(client.services.calculate.signature, {
    args: ["number"],
    result: "number",
  });
  const service = server.services.calculate;
  const module = await import(pathToFileURL(join(output, service.module)).href);
  assert.equal(module[service.exportName](2.25), 4.5);
  assert.deepEqual(
    [...module.__kalandraSchemas[service.exportName]].sort(),
    service.schemas,
  );
  const remoteSource = join(root, "client.kalandra");
  await Bun.write(join(root, "contract.json"), JSON.stringify(client));
  await Bun.write(
    remoteSource,
    'from "remote:./contract.json" import calculate\nexport fn main: await calculate 2.25',
  );
  const clientOutput = join(root, "client-out");
  const remoteBuild = Bun.spawnSync(
    [
      process.execPath,
      resolve(cli),
      "build",
      remoteSource,
      "-o",
      clientOutput,
      "--strict",
    ],
    { cwd: directory },
  );
  assert.equal(remoteBuild.exitCode, 0, remoteBuild.stderr.toString());
  const imported = JSON.parse(
    await readFile(join(clientOutput, "kalandra.remotes.json"), "utf8"),
  );
  assert.equal(imported.contracts["contract.json"].revision, client.revision);
  const remoteProgram = await import(
    pathToFileURL(join(clientOutput, ".kalandra/program.mjs")).href
  );
  assert.equal(
    await remoteProgram.run(
      async (task: { module: string; args: number[] }) => {
        assert.equal(task.module, "kalandra-remote:contract.json/calculate");
        return task.args[0]! * 2;
      },
      "main",
      [],
    ),
    4.5,
  );
  const unsupportedRun = Bun.spawnSync(
    [process.execPath, resolve(cli), "run", remoteSource, "--strict"],
    { cwd: directory },
  );
  assert.equal(unsupportedRun.exitCode, 1);
  assert.match(unsupportedRun.stderr.toString(), /host endpoint bindings/);
  assert.equal(run("--service", "calculate=missing").exitCode, 1);
  assert.equal(await readFile(serverPath, "utf8"), saved);
  assert.equal(
    run("--service", "calculate=double", "--service", "calculate=double")
      .exitCode,
    1,
  );
  assert.equal(run("--service", "calculate=double", "--watch").exitCode, 1);
  assert.equal(run("--service", "invalid").exitCode, 1);
  await Bun.write(source, "export fn double n: n");
  const bad = run("--service", "calculate=double");
  assert.equal(bad.exitCode, 1);
  assert.match(bad.stderr.toString(), /KAL4202/);
  assert.equal(await readFile(serverPath, "utf8"), saved);
}
