const { Method } = require("../src/method");

test("method internal", () => {
  const method = new Method("foo", "bar", "baz");
  const object = {
    foo: {
      bar: {
        baz() {
          return "foundme";
        }
      }
    }
  };
  expect(method.get(object)()).toEqual("foundme");
});
