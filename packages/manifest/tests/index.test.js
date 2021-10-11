import index from "../index.js";

test("Index is defined", () => {
  expect(Object.keys({ ...index }).length).toBeGreaterThan(0);
});
