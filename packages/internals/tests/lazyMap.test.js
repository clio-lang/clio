const { LazyMap } = require("../src/lazyMap");
const { Array } = require("../src/array");
const { Range } = require("../src/range");

test("Map a function using LazyMap", () => {
  const map = new LazyMap({
    getter: i => i,
    length: 3,
    fn: n => n * 2
  });
  const arr = map.toArray();
  const expected = [0, 2, 4];
  expect(arr.items.every((item, index) => item == expected[index])).toBe(true);
});

test("Map a function to LazyMap", () => {
  const map = new LazyMap({
    getter: i => i,
    length: 3,
    fn: n => n * 2
  });
  const arr = map.map(n => n + 1);
  const expected = [1, 3, 5];
  expect(arr.items.every((item, index) => item == expected[index])).toBe(true);
});

test("Map a function to LazyMap (using .lazyMap)", () => {
  const map = new LazyMap({
    getter: i => i,
    length: 3,
    fn: n => n * 2
  });
  const newMap = map.lazyMap(n => n + 1);
  const arr = newMap.toArray();
  const expected = [1, 3, 5];
  expect(arr.items.every((item, index) => item == expected[index])).toBe(true);
});

test("Slice a lazyMap (with a number)", () => {
  const map = new LazyMap({
    getter: i => i,
    length: 3,
    fn: n => n * 2
  });
  const newMap = map.lazyMap(n => n + 1);
  const slice = newMap.slice(new Array(1));
  expect(slice).toBe(3);
});

test("Slice a lazyMap (with a range)", () => {
  const map = new LazyMap({
    getter: i => i,
    length: 3,
    fn: n => n * 2
  });
  const newMap = map.lazyMap(n => n + 1);
  const slice = newMap.slice(new Range({ start: 1 }));
  const expected = [3, 5];
  expect(slice.items.every((item, index) => item == expected[index])).toBe(
    true
  );
});

test("Slice a lazyMap (with an array)", () => {
  const map = new LazyMap({
    getter: i => i,
    length: 3,
    fn: n => n * 2
  });
  const newMap = map.lazyMap(n => n + 1);
  const slice = newMap.slice(new Array(new Array(1, 2)));
  const expected = [3, 5];
  expect(slice.items.every((item, index) => item == expected[index])).toBe(
    true
  );
});
