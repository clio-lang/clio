const { Range } = require("../src/range");
const { Array } = require("../src/array");

const check = (arr, range, expected) => {
  expect(arr.items).toEqual(expected);
  expect(arr.items.length).toBe(expected.length);
  expect(range.length).toBe(expected.length);
};

test("Created range equals array", () => {
  const range = new Range({ start: 0, end: 10, step: 1 });
  const arr = range.toArray();
  const expected = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  check(arr, range, expected);
});

test("Range with steps", () => {
  const range = new Range({ start: 0, end: 10, step: 2 });
  const arr = range.toArray();
  const expected = [0, 2, 4, 6, 8];
  check(arr, range, expected);
});

test("Range with negative steps", () => {
  const range = new Range({ start: 0, end: -10, step: -2 });
  const arr = range.toArray();
  const expected = [0, -2, -4, -6, -8];
  check(arr, range, expected);
});

test("Map function to range", () => {
  const arr = new Range({ start: 0, end: 10, step: 2 }).map(n => n * 2);
  const expected = [0, 4, 8, 12, 16];
  check(arr, arr, expected);
});

test("Slice range (with a number)", () => {
  const range = new Range({ end: 10 });
  const slice = range.slice(new Array(0));
  expect(slice).toEqual(0);
});

test("Slice range (with a range)", () => {
  const range = new Range({ end: 10 });
  const slice = range.slice(new Range({ start: 1, end: 3 }));
  expect(slice.items).toEqual([1, 2]);
});

test("Slice range (with an array)", () => {
  const range = new Range({ end: 10 });
  const slice = range.slice(new Array(new Array(1, 2)));
  expect(slice.items).toEqual([1, 2]);
});
