const { Flow } = require("../flow");
const { Scope } = require("../scope");

test("Test JavaScript function call", () => {
  const flow = new Flow(new Scope({}), 10).pipe(n => n * 2);
  expect(flow.data).toBe(20);
});

test("Test property set", () => {
  const scope = new Scope({});
  new Flow(scope, {}).set("key");
  new Flow(scope, 10).set("key.subkey");
  expect(scope.get("key").subkey).toBe(10);
});
