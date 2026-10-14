import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { externalPackage, numberFunction } from "./external-types-cli.js";

export function startWatch(cli: string, main: string, output: string) {
  let log = "";
  const child = Bun.spawn(
    [process.execPath, cli, "build", main, "-o", output, "--watch", "--strict"],
    { stdout: "pipe", stderr: "pipe" },
  );
  async function consume(stream: ReadableStream<Uint8Array>) {
    const decoder = new TextDecoder();
    const reader = stream.getReader();
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        log += decoder.decode(chunk.value, { stream: true });
      }
    } finally {
      reader.releaseLock();
    }
  }
  const streams = Promise.all([consume(child.stdout), consume(child.stderr)]);
  const count = (text: string) => log.split(text).length - 1;
  async function until(predicate: () => boolean) {
    const deadline = Date.now() + 10000;
    while (!predicate()) {
      if (Date.now() > deadline || child.exitCode !== null)
        throw new Error(`Watch did not reach expected state:\n${log}`);
      await Bun.sleep(20);
    }
  }
  return {
    child,
    count,
    until,
    log: () => log,
    async stop(signal: "SIGINT" | "SIGTERM" = "SIGTERM") {
      child.kill(signal);
      const timer = setTimeout(() => child.kill("SIGKILL"), 10000);
      try {
        assert.equal(await child.exited, 0, log);
        await streams;
        assert.match(log, /Watch stopped/);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export async function verifyWatchCli(cli: string, directory: string) {
  const root = join(directory, "watch-project"),
    main = join(root, "src/nested/main.kalandra"),
    output = join(root, "out");
  await Bun.write(join(root, "kalandra.toml"), '[build]\nsource = "src"');
  await Bun.write(join(root, "src/value.kalandra"), "export value = 1");
  await Bun.write(main, 'from "/value" import value\nexport fn main: value');
  const watch = startWatch(cli, main, output);
  let success = 0,
    failure = 0;
  const succeeded = async () => {
    success++;
    await watch.until(() => watch.count("Watch: build succeeded") === success);
  };
  const failed = async () => {
    failure++;
    await watch.until(() => watch.count("Watch: build failed") === failure);
  };
  try {
    await succeeded();
    const generated = join(output, "value.kalandra.mjs");
    const original = await Bun.file(generated).text();
    await writeFile(join(root, "src/value.kalandra"), "export value = 2");
    await succeeded();
    assert.notEqual(await Bun.file(generated).text(), original);
    const good = await Bun.file(generated).text();
    await writeFile(join(root, "src/value.kalandra"), "fn broken:");
    await failed();
    assert.equal(await Bun.file(generated).text(), good);
    await rm(join(root, "src/value.kalandra"));
    await failed();
    await writeFile(join(root, "src/value.kalandra"), "export value = 3");
    await succeeded();
    // A changed graph starts observing a previously missing candidate.
    await writeFile(main, 'from "./added" import value\nexport fn main: value');
    await failed();
    await writeFile(
      join(root, "src/nested/added.kalandra"),
      "export value = 4",
    );
    await succeeded();
    // Root changes retain paths relative to the new source root.
    await writeFile(
      join(root, "kalandra.toml"),
      '[build]\nsource = "src/nested"',
    );
    await succeeded();
    assert.equal(
      await Bun.file(join(output, "main.kalandra.mjs")).exists(),
      true,
    );
    await writeFile(join(root, "kalandra.toml"), "[");
    await failed();
    await rm(join(root, "kalandra.toml"));
    await succeeded();
    // Generated and unrelated files must not trigger rebuilds.
    await writeFile(join(output, "unrelated.txt"), "output");
    await writeFile(join(root, "src/unrelated.kalandra"), "bad syntax !!!");
    await Bun.sleep(600);
    assert.equal(watch.count("Watch: build succeeded"), success);
    assert.equal(watch.count("Watch: build failed"), failure);
    await watch.stop("SIGINT");
  } finally {
    if (watch.child.exitCode === null) {
      watch.child.kill("SIGKILL");
      await watch.child.exited;
    }
  }
}

export async function verifyWatchMetadata(cli: string, directory: string) {
  const root = join(directory, "watch-metadata"),
    main = join(root, "main.kalandra"),
    output = join(root, "out");
  await mkdir(root, { recursive: true });
  await Bun.write(
    main,
    'from "esm:typed-lib" import make\nexport fn main: make 21',
  );
  const watch = startWatch(cli, main, output);
  try {
    await watch.until(() => watch.count("Watch: build failed") === 1);
    const pkg = await externalPackage(root);
    await watch.until(() => watch.count("Watch: build succeeded") === 1);
    const good = await Bun.file(join(output, "main.kalandra.mjs")).text();
    await Bun.write(
      join(pkg, "kalandra.types.json"),
      JSON.stringify({
        version: 1,
        modules: {
          "esm:.": {
            exports: { make: { ...numberFunction, parameters: ["String"] } },
          },
        },
      }),
    );
    await watch.until(() => watch.count("Watch: build failed") >= 2);
    assert.equal(
      await Bun.file(join(output, "main.kalandra.mjs")).text(),
      good,
    );
    // Changing package exports must be resolved by a fresh process.
    const previousFailures = watch.count("Watch: build failed");
    await Bun.write(
      join(pkg, "package.json"),
      JSON.stringify({
        name: "typed-lib",
        type: "module",
        exports: "./new.js",
        kalandra: { types: "kalandra.types.json" },
      }),
    );
    await watch.until(
      () => watch.count("Watch: build failed") > previousFailures,
    );
    await Bun.write(
      join(pkg, "kalandra.types.json"),
      JSON.stringify({
        version: 1,
        modules: { "esm:.": { exports: { make: numberFunction } } },
      }),
    );
    await Bun.write(join(pkg, "new.js"), "export const make = n => n + 1;");
    await watch.until(() => watch.count("Watch: build succeeded") === 2);
    assert.match(
      await Bun.file(join(output, "main.kalandra.mjs")).text(),
      /new\.js/,
    );
    await watch.stop();
  } finally {
    if (watch.child.exitCode === null) {
      watch.child.kill("SIGKILL");
      await watch.child.exited;
    }
  }
}
