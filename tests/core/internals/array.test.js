const { Array } = require("../../../core/internals/array");

test("Created array contains values", () => {
  const arr = new Array(1, 2, 3);
  expect(arr.items[0]).toBe(1);
  expect(arr.items[1]).toBe(2);
  expect(arr.items[2]).toBe(3);
});

test("Array is mappable", () => {
  const arr = new Array(1, 2, 3);
  const mapped = arr.map(i => i * 2);

  expect(mapped.items[0]).toBe(2);
  expect(mapped.items[1]).toBe(4);
  expect(mapped.items[2]).toBe(6);
});
