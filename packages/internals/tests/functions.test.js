const { Fn } = require("../src/functions");
const { Lazy } = require("../src/lazy");

test("Test Clio function currying", () => {
  const add = new Fn((scope, a, b) => a + b, null, Lazy);
  const add2 = add.call(2);
  expect(add2).toBeInstanceOf(Fn);
  expect(add2.call(3).valueOf()).toBe(5);
});
