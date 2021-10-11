import { range } from "../range.js";
import slice from "../slice.js";

describe("Test slice functio", () => {
  test("Slice range", () => {
    const r = range(0, 10, 2);
    const arr = slice(r, [0, 1]);
    expect(arr).toEqual([0, 2]);
  });
  test("Slice array", () => {
    const r = [1, 2, 3, 4, 5];
    const arr = slice(r, [0, 1]);
    expect(arr).toEqual([1, 2]);
  });
  test("Slice range by range", () => {
    const r = range(0, 10, 2);
    const arr = slice(r, range(0, 3));
    expect(arr).toEqual([0, 2, 4]);
  });
  test("Slice array by range", () => {
    const r = [1, 2, 3, 4, 5];
    const arr = slice(r, range(0, 3));
    expect(arr).toEqual([1, 2, 3]);
  });
});
