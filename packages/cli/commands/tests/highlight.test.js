import { _new, highlight } from "../.js";

import { dirSync } from "tmp";
import { join } from "path";

test("Highlight a file", async () => {
  const dir = dirSync({ unsafeCleanup: true });
  await _new(dir.name);
  const source = join(dir.name, "src", "main.clio");
  const highlighted = highlight(source);
  expect(highlighted.includes("log")).toBe(true);
  dir.removeCallback();
});
