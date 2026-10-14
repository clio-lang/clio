import assert from "node:assert/strict";
import { rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { startWatch } from "./watch-cli.js";

export async function verifyAssetsCli(cli: string, directory: string) {
  const root = join(directory, "assets-project"),
    source = join(root, "src"),
    output = join(source, "out"),
    entry = join(source, "main.kalandra");
  await Bun.write(join(root, "kalandra.toml"), '[build]\nsource = "src"\n');
  await Bun.write(entry, "export fn main: 42\n");
  const bytes = new Uint8Array([0, 255, 128, 13, 10]);
  const asset = join(source, "assets/data.bin"),
    copied = join(output, "assets/data.bin");
  await Bun.write(asset, bytes);
  await Bun.write(join(source, ".secret"), "hidden");
  await Bun.write(join(source, "node_modules/ignored.txt"), "dependency");
  const build = (success = true) => {
    const result = Bun.spawnSync([
      process.execPath,
      cli,
      "build",
      entry,
      "-o",
      output,
      "--strict",
    ]);
    assert.equal(result.exitCode, success ? 0 : 1, result.stderr.toString());
    return result.stderr.toString();
  };
  build();
  assert.deepEqual(new Uint8Array(await Bun.file(copied).arrayBuffer()), bytes);
  assert.equal(await Bun.file(join(output, ".secret")).exists(), false);
  assert.equal(
    await Bun.file(join(output, "node_modules/ignored.txt")).exists(),
    false,
  );
  build(); // The nested output must not copy itself.
  assert.equal(
    await Bun.file(join(output, "out/main.kalandra.mjs")).exists(),
    false,
  );
  const original = await Bun.file(join(output, "main.kalandra.mjs")).text();
  await Bun.write(join(source, "main.kalandra.mjs"), "collision");
  assert.match(build(false), /separate destinations/);
  assert.equal(
    await Bun.file(join(output, "main.kalandra.mjs")).text(),
    original,
  );
  await rm(join(source, "main.kalandra.mjs"));
  await symlink(join(directory, "outside"), join(source, "linked"));
  assert.match(build(false), /Asset symlinks/);
  await rm(join(source, "linked"));
  await rm(join(output, "assets"), { recursive: true });
  await Bun.write(join(directory, "outside/data.bin"), "untouched");
  await symlink(join(directory, "outside"), join(output, "assets"));
  assert.match(build(false), /Output must not use symlinks/);
  assert.equal(
    await Bun.file(join(directory, "outside/data.bin")).text(),
    "untouched",
  );
  await rm(join(output, "assets"));
  build();
  const watch = startWatch(cli, entry, output);
  let successes = 0;
  const next = async () => {
    successes++;
    await watch.until(
      () => watch.count("Watch: build succeeded") === successes,
    );
  };
  try {
    await next();
    // Invalid UTF-8 byte changes must still trigger a rebuild.
    await Bun.write(asset, new Uint8Array([0, 254, 128, 13, 10]));
    await next();
    assert.equal(new Uint8Array(await Bun.file(copied).arrayBuffer())[1], 254);
    await Bun.write(join(source, "assets/added.txt"), "new");
    await next();
    assert.equal(
      await Bun.file(join(output, "assets/added.txt")).text(),
      "new",
    );
    await rm(asset);
    await next();
    assert.equal(await Bun.file(copied).exists(), false);
    // A user-modified former asset is not deleted during cleanup.
    await Bun.write(join(output, "assets/added.txt"), "manual edit");
    await rm(join(source, "assets/added.txt"));
    await next();
    assert.equal(
      await Bun.file(join(output, "assets/added.txt")).text(),
      "manual edit",
    );
    await Bun.write(join(source, "unrelated.kalandra"), "not parsed !!!");
    await Bun.write(join(output, "unrelated.txt"), "not an input");
    await Bun.sleep(600);
    assert.equal(watch.count("Watch: build succeeded"), successes);
    await watch.stop();
  } finally {
    if (watch.child.exitCode === null) {
      watch.child.kill("SIGKILL");
      await watch.child.exited;
    }
  }
}
