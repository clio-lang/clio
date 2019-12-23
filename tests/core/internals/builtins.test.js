const {
  add,
  sub,
  mul,
  div,
  print,
  pow
} = require("../../../core/internals/builtins");

test("Add lazily adds two numbers", () => {
  const sum = add.call(1, 2);
  expect(typeof sum).toBe("object");
  expect(sum.fn()).toBe(3);
});

test("Sub lazily subtracts two numbers", () => {
  const outcome = sub.call(1, 2);
  expect(typeof outcome).toBe("object");
  expect(outcome.fn()).toBe(-1);
});

test("Mul lazily multiplies two numbers", () => {
  const outcome = mul.call(2, 2);
  expect(typeof outcome).toBe("object");
  expect(outcome.fn()).toBe(4);
});

test("Div lazily adds divides numbers", () => {
  const outcome = div.call(2, 2);
  expect(typeof outcome).toBe("object");
  expect(outcome.fn()).toBe(1);
});

test("Divide by zero lazily resolves to infinity", () => {
  const outcome = div.call(2, 0);
  expect(typeof outcome).toBe("object");
  expect(outcome.fn()).toBe(Infinity);
});

test("Pow lazily resolves", () => {
  const outcome = pow.call(2, 5);
  expect(typeof outcome).toBe("object");
  expect(outcome.fn()).toBe(32);
});
