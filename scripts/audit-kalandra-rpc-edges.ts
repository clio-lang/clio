import { compileProject } from "../packages/compiler/src/index.js";
const base = await compileProject(
  "base.kalandra",
  {
    readSource: async () =>
      "@params Number Number\n@returns Number\nexport fn add a b: a + b\n",
  },
  { remoteServices: { add: "add" } },
);
const contract = base.output!.files.get("kalandra.client.json")!.code;
const prefix = 'from "remote:./base.json" import add\n';
for (const [name, source] of Object.entries({
  alias:
    prefix +
    "@params Number\nexport fn run n:\n  chosen = add\n  await chosen n 1\n",
  higherOrder:
    prefix +
    "fn invoke f n: await f n 1\n@params Number\nexport fn run n: await invoke add n\n",
  localReturn:
    prefix +
    "fn choose: add\n@params Number\nexport fn run n:\n  chosen = choose ()\n  await chosen n 1\n",
  localTarget:
    "@params Number\nexport fn run n:\n  @params Number\n  fn inner x: x + 1\n  await |inner| n\n",
  initializedLocalTarget:
    "@params Number\nfn make offset:\n  @params Number\n  fn inner x: x + offset\n  inner\nchosen = make 1\n@params Number\nexport fn run n: await |chosen| n\n",
  capturedLocalTarget:
    "@params Number\nexport fn run n:\n  @params Number\n  fn inner x: x + n\n  await |inner| 1\n",
})) {
  const result = await compileProject(
    "main.kalandra",
    {
      readSource: async (p) =>
        p === "main.kalandra" ? source : p === "base.json" ? contract : null,
    },
    { strictNames: true },
  );
  console.log(
    JSON.stringify({
      name,
      source,
      emitted: !!result.output,
      diagnostics: result.diagnostics.map((d) => ({
        code: d.code,
        message: d.message,
      })),
    }),
  );
}
