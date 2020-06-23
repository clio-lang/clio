const { Flow } = require("../src/flow");
const { Scope } = require("../src/scope");
const { Fn } = require("../src/functions");

test("Test JavaScript function call", () => {
  const flow = new Flow(new Scope({}), 10).pipe(n => n * 2);
  expect(flow.data).toBe(20);
});

test("Test JavaScript function map", () => {
  const flow = new Flow(new Scope({}), [0, 1, 2]).map(n => n * 2);
  const expected = [0, 2, 4];
  expect(flow.data.every((item, index) => item === expected[index])).toBe(true);
});

test("Test property set", () => {
  const scope = new Scope({});
  new Flow(scope, {}).set("key");
  new Flow(scope, 10).set("key.subkey");
  expect(scope.get("key").subkey).toBe(10);
});

test("Test JavaScript currying", () => {
  const add = (a, b) => a + b;
  const scope = new Scope({});
  new Flow(scope, 2).pipe(add).set("add2");
  const add2 = scope.$.add2;
  const flow = new Flow(scope, 3).pipe(add2);
  expect(add2).toBeInstanceOf(Fn);
  expect(flow.data).toBe(5);
});
