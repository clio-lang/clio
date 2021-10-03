import { range } from "../range.js";

describe("Test Range functionality", () => {
  test("Range.toArray", () => {
    const r = range(0, 10, 2);
    const arr = r.toArray();
    expect(arr).toEqual([0, 2, 4, 6, 8]);
  });
  test("Range.take", () => {
    const r = range(0, null, 1).take(5);
    const arr = r.toArray();
    expect(arr).toEqual([0, 1, 2, 3, 4]);
  });
  test("Range.skip", () => {
    const r = range(0, 10, 1).skip(5);
    const arr = r.toArray();
    expect(arr).toEqual([5, 6, 7, 8, 9]);
  });
  test("Range.get", () => {
    const r = range(0, 10, 1);
    expect(r.get(2)).toEqual(2);
  });
  test("Range.length", () => {
    const r = range(0, 10, 1);
    expect(r.length).toEqual(10);
  });
  test("Range.map", () => {
    const r = range(0, 5, 1).map((n) => n * 2);
    expect(r.toArray()).toEqual([0, 2, 4, 6, 8]);
  });
});
