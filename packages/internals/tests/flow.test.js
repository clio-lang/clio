const { Flow } = require("../src/flow");
const { Scope } = require("../src/scope");

test("Test JavaScript function call", () => {
  const flow = new Flow(new Scope({}), 10).pipe(n => n * 2);
  expect(flow.data).toBe(20);
});

test("Test JavaScript function map", () => {
  const flow = new Flow(new Scope({}), [0, 1, 2]).map(n => n * 2);
  const expected = [0, 2, 4];
  expect(flow.data.every((item, index) => item == expected[index])).toBe(true);
});

test("Test property set", () => {
  const scope = new Scope({});
  new Flow(scope, {}).set("key");
  new Flow(scope, 10).set("key.subkey");
  expect(scope.get("key").subkey).toBe(10);
});
