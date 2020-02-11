const { Fn, getArity } = require("../src/functions");
const { Lazy } = require("../src/lazy");

test("Test Clio function currying", () => {
  const add = new Fn((scope, a, b) => a + b, null, Lazy);
  const add2 = add(2);
  expect(add2).toBeInstanceOf(Fn);
  expect(add2(3).valueOf()).toBe(5);
});

test("Test getArity", () => {
  const arity = getArity(function(a, b, c) {
    return a + b + c;
  });
  expect(arity).toBe(3);
});

test("Test getArity on fat arrow functions", () => {
  const arity = getArity((a, b, c) => a + b + c);
  expect(arity).toBe(3);
});

test("Test getArity with default values", () => {
  const arity = getArity((a, b = 2, c) => a + b + c);
  expect(arity).toBe(3);
});

test("Test getArity with rest operator", () => {
  const arity = getArity((a, b, ...rest) => [a, b, ...rest]);
  expect(arity).toBe(Infinity);
});
