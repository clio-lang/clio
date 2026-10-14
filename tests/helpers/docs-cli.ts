import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

export async function verifyDocsCli(cli: string, directory: string) {
  const root = join(directory, "source-docs"),
    file = join(root, "library.kalandra"),
    marker = join(root, "executed");
  await Bun.write(
    join(root, "effects.mjs"),
    `await Bun.write(${JSON.stringify(marker)}, "executed"); throw new Error("must not load");`,
  );
  await Bun.write(
    file,
    'import "./missing"\nimport "esm:./effects.mjs" as effects\n@describe "Doubles a number"\n@params Number\n@returns Number\nexport fn double value: value * 2\n@describe (makeDescription ())\nfn dynamic: 1\nfn plain:\n  fn nested: 2\n  nested\n',
  );
  const before = await readdir(root);
  const run = (...args: string[]) =>
    Bun.spawnSync([process.execPath, cli, "docs", file, ...args]);
  const all = run("--json");
  assert.equal(all.exitCode, 0, all.stderr.toString());
  const data = JSON.parse(all.stdout.toString());
  assert.equal(data.version, 1);
  assert.deepEqual(
    data.functions.map((fn: { name: string }) => fn.name),
    ["double", "dynamic", "plain"],
  );
  assert.equal(data.functions[0].description, "Doubles a number");
  assert.equal(data.functions[0].exported, true);
  assert.deepEqual(data.functions[0].parameters, ["value"]);
  assert.equal(data.functions[1].descriptionStatus, "dynamic");
  const selected = run("double");
  assert.equal(selected.exitCode, 0);
  assert.match(selected.stdout.toString(), /export fn double value/);
  assert.match(selected.stdout.toString(), /@params Number/);
  assert.match(selected.stdout.toString(), /@returns Number/);
  assert.match(selected.stdout.toString(), /Doubles a number/);
  assert.doesNotMatch(selected.stdout.toString(), /fn plain/);
  assert.match(run("dynamic").stdout.toString(), /unavailable statically/);
  for (const args of [
    ["missing"],
    ["nested"],
    ["--json", "--json"],
    ["--strict"],
    ["double", "plain"],
  ]) {
    const failed = run(...args);
    assert.equal(failed.exitCode, 1);
    assert.equal(failed.stdout.toString(), "");
  }
  assert.equal(await Bun.file(marker).exists(), false);
  assert.deepEqual(await readdir(root), before);
  await Bun.write(file, "fn :");
  const invalid = run("--json");
  assert.equal(invalid.exitCode, 1);
  assert.match(invalid.stderr.toString(), /KAL2001/);
  assert.equal(invalid.stdout.toString(), "");
}
