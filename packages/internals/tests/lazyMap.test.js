const { LazyMap } = require("../src/lazyMap");
const { Array } = require("../src/array");
const { Range } = require("../src/range");

const makeLazyMap = () =>
  new LazyMap({
    getter: (i) => i,
    length: 3,
    fn: (n) => n * 2,
  });

test("Map a function using LazyMap", async () => {
  const map = makeLazyMap();
  const arr = await map.toArray();
  const expected = [0, 2, 4];
  expect(arr.items.every((item, index) => item == expected[index])).toBe(true);
});

test("Map a function to LazyMap", async () => {
  const map = makeLazyMap();
  const arr = await map.map((n) => n + 1);
  const expected = [1, 3, 5];
  expect(arr.items).toEqual(expected);
});

test("Map a function to LazyMap (using .lazyMap)", async () => {
  const map = makeLazyMap();
  const newMap = map.lazyMap((n) => n + 1);
  const arr = await newMap.toArray();
  const expected = [1, 3, 5];
  expect(arr.items).toEqual(expected);
});

test("Slice a lazyMap (with a number)", async () => {
  const map = makeLazyMap();
  const newMap = map.lazyMap((n) => n + 1);
  const slice = await newMap.slice(new Array(1));
  expect(slice).toBe(3);
});

test("Slice a lazyMap (with a range)", async () => {
  const map = makeLazyMap();
  const newMap = map.lazyMap((n) => n + 1);
  const slice = await newMap.slice(new Range({ start: 1 }));
  const expected = [3, 5];
  const items = await Promise.all(slice.items);
  expect(items).toEqual(expected);
});

test("Slice a lazyMap (with a range, negative steps)", async () => {
  const map = makeLazyMap();
  const newMap = map.lazyMap((n) => n + 1);
  const slice = await newMap.slice(new Range({ start: 3, end: 0 }));
  const expected = [5, 3];
  const items = await Promise.all(slice.items);
  expect(items).toEqual(expected);
});

test("Slice a lazyMap (with an array[range])", async () => {
  const map = makeLazyMap();
  const newMap = map.lazyMap((n) => n + 1);
  const slice = await newMap.slice(new Array(new Range({ start: 1 })));
  const expected = [3, 5];
  const items = await Promise.all(slice.items);
  expect(items).toEqual(expected);
});

test("Slice a lazyMap (with an array)", async () => {
  const map = makeLazyMap();
  const newMap = map.lazyMap((n) => n + 1);
  const slice = await newMap.slice(new Array(new Array(1, 2)));
  const expected = [3, 5];
  const items = await Promise.all(slice.items);
  expect(items).toEqual(expected);
});

test("Slice a lazyMap (multidimensional)", async () => {
  const map = new LazyMap({
    getter: (i) => i,
    length: 3,
    fn: (n) => new Array(n, n + 1, n + 2),
  });
  const slice = await map.slice(new Array(new Array(0, 2), 1));
  const expected = [1, 3];
  const items = await Promise.all(slice.items);
  expect(items).toEqual(expected);
});
