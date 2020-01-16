const { Array } = require("../src/array");
const { Array: ArrayFromIndex } = require("../src");

test("packages/clio-internals exports", () => {
  const array = new ArrayFromIndex([]);

  expect(array).toBeInstanceOf(Array);
});
