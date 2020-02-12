const { Fn } = require("../src/functions");
const { getArity } = require("../src/arity");
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

test("Test getArity with function declaration", () => {
  const arity = getArity(function myFunction(a, b, c) {
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

test("Test getArity with deconstructing parameters", () => {
  const arity = getArity((a, { x, y, z }, c = [1, 2, 3]) => {
    return [a + x + y + z, ...c];
  });
  expect(arity).toBe(3);
});

test("Test getArity with array and object as default values", () => {
  const arity = getArity((a, c = [1, 2, 3], i = { x, y, z }) => {
    return [a + x + y + z, i, ...c];
  });
  expect(arity).toBe(3);
});

test("Test getArity with string and parentheses default values", () => {
  const arity = getArity((a, c = ",", b = 2 && (3 || 4)) => {
    return [a, c, b];
  });
  expect(arity).toBe(3);
});

test("Test getArity with parentheses default value", () => {
  const arity = getArity(function(a, b = 2 && (3 || 4)) {
    return [a, b];
  });
  expect(arity).toBe(2);
});

test("Test getArity with native functions", () => {
  const arity = getArity(Math.pow);
  expect(arity).toBe(2);
});
