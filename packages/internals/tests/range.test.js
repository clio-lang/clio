const { Range } = require("../src/range");

test("Created range equals array", () => {
  const range = new Range({ start: 0, end: 10, step: 1 });
  const arr = range.toArray();
  const expected = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  expect(arr.items.every((item, index) => item == expected[index])).toBe(true);
  expect(arr.items.length).toBe(expected.length);
  expect(range.length).toBe(expected.length);
});

test("Range with steps", () => {
  const range = new Range({ start: 0, end: 10, step: 2 });
  const arr = range.toArray();
  const expected = [0, 2, 4, 6, 8];
  expect(arr.items.every((item, index) => item == expected[index])).toBe(true);
  expect(arr.items.length).toBe(expected.length);
  expect(range.length).toBe(expected.length);
});

test("Range with negative steps", () => {
  const range = new Range({ start: 0, end: -10, step: -2 });
  const arr = range.toArray();
  const expected = [0, -2, -4, -6, -8];
  expect(arr.items.every((item, index) => item == expected[index])).toBe(true);
  expect(arr.items.length).toBe(expected.length);
  expect(range.length).toBe(expected.length);
});

test("Map function to range", () => {
  const arr = new Range({ start: 0, end: 10, step: 2 }).map(n => n * 2);
  const expected = [0, 4, 8, 12, 16];
  expect(arr.items.every((item, index) => item == expected[index])).toBe(true);
  expect(arr.items.length).toBe(expected.length);
  expect(arr.length).toBe(expected.length);
});
