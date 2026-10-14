import assert from "node:assert/strict";
import { join } from "node:path";

export const numberFunction = {
  kind: "Callable",
  parameters: ["Number"],
  returns: "Number",
  async: false,
};
export async function externalPackage(root: string) {
  const path = join(root, "node_modules/typed-lib");
  await Bun.write(
    join(path, "package.json"),
    JSON.stringify({
      name: "typed-lib",
      type: "module",
      exports: { ".": "./index.js", "./sub": "./sub.js" },
      kalandra: { types: "./kalandra.types.json" },
    }),
  );
  await Bun.write(
    join(path, "index.js"),
    "export const make = n => n; export default make;",
  );
  await Bun.write(join(path, "sub.js"), "export const label = 'hello';");
  await Bun.write(
    join(path, "kalandra.types.json"),
    JSON.stringify({
      version: 1,
      modules: {
        "esm:.": { exports: { make: numberFunction, default: numberFunction } },
        "esm:./sub": { exports: { label: "String" } },
      },
    }),
  );
  return path;
}
export async function verifyExternalTypesCli(cli: string, directory: string) {
  const root = join(directory, "external-types");
  await externalPackage(root);
  const main = join(root, "main.kalandra");
  await Bun.write(
    main,
    'from "esm:typed-lib" import make\n@params Number\n@returns Number\nexport fn twice n: n * 2\nexport fn main: await |twice| (make 21)',
  );
  const run = Bun.spawnSync([process.execPath, cli, "run", main, "--strict"], {
    cwd: root,
  });
  assert.equal(run.exitCode, 0, run.stderr.toString());
  assert.equal(run.stdout.toString().trim(), "42");
  await Bun.write(main, 'from "esm:typed-lib" import make\nmake "wrong"');
  const fail = Bun.spawnSync(
    [process.execPath, cli, "build", main, "-o", join(root, "out"), "--strict"],
    { cwd: root },
  );
  assert.equal(fail.exitCode, 1);
  assert.match(fail.stderr.toString(), /KAL3106/);
}
