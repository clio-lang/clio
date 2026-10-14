import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

export async function verifyProjectRootCli(cli: string, directory: string) {
  const project = join(directory, "manifest-project");
  const nested = join(project, "src", "nested");
  await mkdir(nested, { recursive: true });
  await Bun.write(join(project, "kalandra.toml"), '[build]\nsource = "src"\n');
  await Bun.write(join(project, "src/value.kalandra"), "export value = 21");
  await Bun.write(
    join(project, "src/.kalandra/modules/math/kalandra.toml"),
    '[build]\nsource = "lib"\n',
  );
  await Bun.write(
    join(project, "src/.kalandra/modules/math/lib/main.kalandra"),
    "@params Number\n@returns Number\nexport fn double n: n * 2",
  );
  await Bun.write(
    join(nested, "main.kalandra"),
    'from "/value" import value\nfrom "../value" import value as relativeValue\nfrom "math" import double\nexport fn main: await |double| (value + relativeValue)',
  );
  for (const [cwd, entry] of [
    [project, "src/nested/main.kalandra"],
    [nested, "main.kalandra"],
    [directory, join(nested, "main.kalandra")],
  ]) {
    const result = Bun.spawnSync(
      [process.execPath, cli, "run", entry!, "--strict"],
      { cwd: cwd! },
    );
    assert.equal(result.exitCode, 0, result.stderr.toString());
    assert.equal(result.stdout.toString().trim(), "84");
  }
  const output = join(project, "out");
  const built = Bun.spawnSync(
    [process.execPath, cli, "build", "main.kalandra", "-o", output, "--strict"],
    { cwd: nested },
  );
  assert.equal(built.exitCode, 0, built.stderr.toString());
  assert.equal(
    await Bun.file(join(output, "nested/main.kalandra.mjs")).exists(),
    true,
  );
}
