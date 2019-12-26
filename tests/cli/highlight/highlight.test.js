const path = require("path");
const tmp = require("tmp");
const { createPackage } = require("../../../cli/commands/new");
const { highlight } = require("../../../cli/commands/highlight");

test("Highlight a file", async () => {
  const dir = tmp.dirSync();
  await createPackage(dir.name);
  const source = path.join(dir.name, "index.clio");
  const highlighted = highlight(source);
  expect(highlighted.includes("print")).toBe(true);
  dir.removeCallback();
});
