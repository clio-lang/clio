const { add, sub, mul, div, pow } = require("../src/builtins");

test("Add lazily adds two numbers", () => {
  const sum = add(1, 2);
  expect(typeof sum).toBe("object");
  expect(sum.fn()).toBe(3);
});

test("Sub lazily subtracts two numbers", () => {
  const outcome = sub(1, 2);
  expect(typeof outcome).toBe("object");
  expect(outcome.fn()).toBe(-1);
});

test("Mul lazily multiplies two numbers", () => {
  const outcome = mul(2, 2);
  expect(typeof outcome).toBe("object");
  expect(outcome.fn()).toBe(4);
});

test("Div lazily adds divides numbers", () => {
  const outcome = div(2, 2);
  expect(typeof outcome).toBe("object");
  expect(outcome.fn()).toBe(1);
});

test("Divide by zero lazily resolves to infinity", () => {
  const outcome = div(2, 0);
  expect(typeof outcome).toBe("object");
  expect(outcome.fn()).toBe(Infinity);
});

test("Pow lazily resolves", () => {
  const outcome = pow(2, 5);
  expect(typeof outcome).toBe("object");
  expect(outcome.fn()).toBe(32);
});
