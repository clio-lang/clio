import {
  check,
  describe as desc,
  help,
  params,
  returns,
} from "../decorators.js";

import { jest } from "@jest/globals";

const getFn = () => (a, b) => a + b;

describe("Test decorators", () => {
  test("describe", () => {
    const __doc__ = "Adds a and b";
    const fn = desc(__doc__, getFn());
    expect(fn(2, 3)).toEqual(5);
    expect(fn.__doc__).toEqual(__doc__);
  });
  test("help", () => {
    console.log = jest.fn();
    const __doc__ = "Adds a and b";
    const fn = desc(__doc__, getFn());
    expect(fn(2, 3)).toEqual(5);
    help(fn);
    expect(console.log).toBeCalledWith(__doc__);
  });
  test("params", () => {
    const __accepts__ = [Number, Number];
    const fn = params(...__accepts__, getFn());
    expect(fn(2, 3)).toEqual(5);
    expect(fn.__accepts__).toEqual(__accepts__);
  });
  test("returns", () => {
    const __returns__ = Number;
    const fn = returns(__returns__, getFn());
    expect(fn(2, 3)).toEqual(5);
    expect(fn.__returns__).toEqual(__returns__);
  });
  test("check (Accepts)", () => {
    const __accepts__ = [Number, Number];
    const fn = check(params(...__accepts__, getFn()));
    expect(fn(2, 3)).toEqual(5);
    expect(() => fn("2", "3")).toThrow(
      "Argument of type String at position 0 does not satisfy parameter of type Number"
    );
  });
  test("check (Returns)", () => {
    const fn = check(returns(String, getFn()));
    expect(() => fn(2, 3)).toThrow(
      "Returned value 5 with type Number does not satisfy return type of String"
    );
  });
  test("check (Array)", () => {
    const __accepts__ = [Number];
    const fn = check(params(__accepts__, getFn()));
    expect(() => fn(["Hello"])).toThrow(
      "Argument of type Array[String] at position 0 does not satisfy parameter of type Array[Number]"
    );
  });
  test("check (Array x Non-Array)", () => {
    const __accepts__ = [Number];
    const fn = check(params(__accepts__, getFn()));
    expect(() => fn("Hello")).toThrow(
      "Argument of type String at position 0 does not satisfy parameter of type Array[Number]"
    );
  });
  test("check (Date)", () => {
    const __accepts__ = Date;
    const fn = check(params(__accepts__, getFn()));
    expect(() => fn("Hello")).toThrow(
      "Argument of type String at position 0 does not satisfy parameter of type Date"
    );
  });
});
