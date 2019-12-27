const path = require("path");
const tmp = require("tmp");
const { createPackage } = require("../new");
const { highlight } = require("../highlight");

test("Highlight a file", async () => {
  const dir = tmp.dirSync();
  await createPackage(dir.name);
  const source = path.join(dir.name, "src/main.clio");
  const highlighted = highlight(source);
  expect(highlighted.includes("print")).toBe(true);
  dir.removeCallback();
});
