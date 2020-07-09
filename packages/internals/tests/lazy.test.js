const { Lazy, lazy } = require("../src/lazy");

test("Lazy evaluates when valueOf() is called", async () => {
  const lzy = new Lazy(() => "foo");
  const value = await lzy.valueOf();

  expect(lzy.fn).toBeDefined();
  expect(value).toBe("foo");
});

test("Lazy function wrapper evaluates when valueOf is called", async () => {
  const lzy = lazy(() => 2);
  const value = await lzy.valueOf();

  expect(lzy.fn).toBeDefined();
  expect(value).toBe(2);
});
