import assert from "node:assert/strict";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";

export async function gitFixture(path: string, files: Record<string, string>) {
  await mkdir(path, { recursive: true });
  const git = (...args: string[]) => {
    const result = Bun.spawnSync(
      [
        "git",
        "-c",
        "core.hooksPath=/dev/null",
        "-c",
        "user.name=Kalandra Tests",
        "-c",
        "user.email=tests@example.invalid",
        "-c",
        "commit.gpgsign=false",
        ...args,
      ],
      { cwd: path },
    );
    assert.equal(result.exitCode, 0, result.stderr.toString());
    return result.stdout.toString().trim();
  };
  git("init", "-q");
  for (const [file, text] of Object.entries(files))
    await Bun.write(join(path, file), text);
  git("add", ".");
  git("commit", "-qm", "fixture");
  git("tag", "v1");
  return git;
}

export async function verifyInstallCli(cli: string, directory: string) {
  const base = join(directory, "install-example");
  const leaf = join(base, "leaf"),
    math = join(base, "math"),
    project = join(base, "project");
  const leafGit = await gitFixture(leaf, {
    "kalandra.toml": '[build]\nsource = "src"',
    "src/main.kalandra":
      "@params Number\n@returns Number\nexport fn double n: n * 2",
  });
  await gitFixture(math, {
    "kalandra.toml": `[build]\nsource = "lib"\n[dependencies]\n${JSON.stringify(leaf)} = "v1"`,
    "lib/main.kalandra":
      'from "leaf@v1" import double\n@params Number\n@returns Number\nexport fn calculate n: double n',
  });
  const manifest = `[build]\nsource = "src"\n[dependencies]\n${JSON.stringify(math)} = "v1"\n${JSON.stringify(leaf)} = "v1"\n`;
  await Bun.write(join(project, "kalandra.toml"), manifest);
  await Bun.write(
    join(project, "src/nested/main.kalandra"),
    'from "math@v1" import calculate\nexport fn main: await |calculate| 21',
  );
  const run = (...args: string[]) =>
    Bun.spawnSync([process.execPath, cli, ...args], {
      cwd: join(project, "src/nested"),
    });
  const first = run("install");
  assert.equal(first.exitCode, 0, first.stderr.toString());
  assert.match(first.stdout.toString(), /2 Kalandra packages \(2 new\)/);
  assert.equal(
    await readFile(join(project, "kalandra.toml"), "utf8"),
    manifest,
  );
  assert.deepEqual(
    (await readdir(join(project, "src/.kalandra/modules"))).sort(),
    ["leaf@v1", "math@v1"],
  );
  const result = run("run", "main.kalandra", "--strict");
  assert.equal(result.exitCode, 0, result.stderr.toString());
  assert.equal(result.stdout.toString().trim(), "42");
  const again = run("install", project);
  assert.equal(again.exitCode, 0, again.stderr.toString());
  assert.match(again.stdout.toString(), /2 Kalandra packages \(0 new\)/);
  const lock = await readFile(join(project, "kalandra.lock"), "utf8");
  assert.equal(JSON.parse(lock).packages.length, 2);
  // Moving a tag cannot change a fresh installation while its commit is locked.
  await Bun.write(join(leaf, "src/main.kalandra"), "export answer = 999");
  leafGit("add", ".");
  leafGit("commit", "-qm", "move tag");
  leafGit("tag", "-f", "v1");
  await rm(join(project, "src/.kalandra/modules"), { recursive: true });
  const pinned = run("install");
  assert.equal(pinned.exitCode, 0, pinned.stderr.toString());
  assert.equal(await readFile(join(project, "kalandra.lock"), "utf8"), lock);
  assert.equal(
    run("run", "main.kalandra", "--strict").stdout.toString().trim(),
    "42",
  );
}
