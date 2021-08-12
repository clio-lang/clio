const { range } = require("../range");

describe("Test Range functionality", () => {
  test("Range.toArray", () => {
    const r = range(0, 10, 2);
    const arr = r.toArray();
    expect(arr).toEqual([0, 2, 4, 6, 8]);
  });
  test("Range.take", () => {
    const r = range(0, 10, 1).take(5);
    const arr = r.toArray();
    expect(arr).toEqual([0, 1, 2, 3, 4]);
  });
  test("Range.skip", () => {
    const r = range(0, 10, 1).skip(5);
    const arr = r.toArray();
    expect(arr).toEqual([5, 6, 7, 8, 9]);
  });
});
