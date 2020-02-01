const path = require("path");
const tmp = require("tmp");
const { _new, highlight } = require("../");

test("Highlight a file", async () => {
  const dir = tmp.dirSync();
  await _new(dir.name);
  const source = path.join(dir.name, "src/main.clio");
  const highlighted = highlight(source);
  expect(highlighted.includes("print")).toBe(true);
  dir.removeCallback();
});
