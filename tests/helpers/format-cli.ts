import assert from "node:assert/strict";
import { join } from "node:path";
import { readFile } from "node:fs/promises";

export async function verifyFormatCli(cli: string, directory: string) {
  const file = join(directory, "format-example.kalandra");
  const source = "-- keep this  \r\nfn  double  n:\r\n    n*2   \r\n";
  const expected = "-- keep this  \nfn double n:\n  n * 2\n";
  await Bun.write(file, source);
  const run = (...flags: string[]) =>
    Bun.spawnSync([process.execPath, cli, "fmt", file, ...flags]);
  const stdout = run();
  assert.equal(stdout.exitCode, 0, stdout.stderr.toString());
  assert.equal(stdout.stdout.toString(), expected);
  assert.equal(await readFile(file, "utf8"), source);
  assert.equal(run("--check").exitCode, 1);
  const written = run("--write");
  assert.equal(written.exitCode, 0, written.stderr.toString());
  assert.equal(await readFile(file, "utf8"), expected);
  assert.equal(run("--check").exitCode, 0);
  await Bun.write(file, "fn :");
  const invalid = run("--write");
  assert.equal(invalid.exitCode, 1);
  assert.equal(await readFile(file, "utf8"), "fn :");
  assert.match(invalid.stderr.toString(), /KAL2001/);
}
