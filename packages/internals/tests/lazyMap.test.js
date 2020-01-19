const { LazyMap } = require("../src/lazyMap");

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
