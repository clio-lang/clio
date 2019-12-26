const { Lazy, lazy } = require("../lazy");

test("Lazy evaluates when valueOf() is called", () => {
  const lzy = new Lazy(() => "foo");

  expect(lzy.fn).toBeDefined();
  expect(lzy.valueOf()).toBe("foo");
});

test("Lazy function wrapper evaluates when valueOf is called", () => {
  const lzy = lazy(() => 2);

  expect(lzy.fn).toBeDefined();
  expect(lzy.valueOf()).toBe(2);
});
