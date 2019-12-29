const { Array } = require("../src/array");
const { io } = require("../src/io");

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

test("Array valueOf", () => {
  const arr = new Array(1, 2, 3);
  const values = arr.valueOf();
  expect(values).toEqual([1, 2, 3]);
});

test("Array is mappable with IO items", () => {
  const first = io(jest.fn());
  const second = io(jest.fn());
  const arr = new Array(first, second);
  const mappedValues = arr.map(i => i);
  expect(mappedValues.items[0]).toEqual(first);
  expect(mappedValues.items[1]).toEqual(second);
});
