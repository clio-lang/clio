const { Array } = require("../src/array");
const { Range } = require("../src/range");

test("Created array contains values", () => {
  const arr = new Array(1, 2, 3);
  expect(arr.items[0]).toBe(1);
  expect(arr.items[1]).toBe(2);
  expect(arr.items[2]).toBe(3);
});

test("Array is mappable", async () => {
  const arr = new Array(1, 2, 3);
  const mapped = await arr.map((i) => i * 2);

  expect(mapped.items[0]).toBe(2);
  expect(mapped.items[1]).toBe(4);
  expect(mapped.items[2]).toBe(6);
});

test("Array valueOf", () => {
  const arr = new Array(1, 2, 3);
  const values = arr.valueOf();
  expect(values).toEqual([1, 2, 3]);
});

test("Array push", () => {
  const arr = new Array(1, 2);
  arr.push(3);
  const values = arr.valueOf();
  expect(values).toEqual([1, 2, 3]);
});

test("Slice array (with a number)", async () => {
  const arr = new Array(1, 2, 3);
  const slice = await arr.slice(new Array(0));
  expect(slice).toEqual(1);
});

test("Slice array (with a range)", async () => {
  const arr = new Array(1, 2, 3);
  const slice = await arr.slice(new Range({ start: 1 }));
  expect(slice.items).toEqual([2, 3]);
});

test("Slice a lazyMap (with a range, negative steps)", async () => {
  const arr = new Array(1, 2, 3);
  const slice = await arr.slice(new Range({ start: 3, end: 0 }));
  expect(slice.items).toEqual([3, 2]);
});

test("Slice array (with an array)", async () => {
  const arr = new Array(1, 2, 3);
  const slice = await arr.slice(new Array(new Array(1, 2)));
  expect(slice.items).toEqual([2, 3]);
});

test("Slice array (multidimensional)", async () => {
  const arr = new Array(
    new Array(1, 2, 3),
    new Array(4, 5, 6),
    new Array(7, 8, 9)
  );
  const slice = await arr.slice(new Array(new Array(0, 1), 1));
  expect(slice.items).toEqual([2, 5]);
});
