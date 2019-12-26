const { Scope } = require("../../../core/internals/scope");

test("Scope.$ should call Scope.get and return the value for key", () => {
  const scope = new Scope({ lang: "Clio" });
  expect(scope.$.lang).toBe("Clio");
});

test("If key isn't in Scope it should be fetched from outer Scope", () => {
  const outerScope = new Scope({ lang: "Clio" });
  const scope = new Scope({}, outerScope);
  expect(scope.$.lang).toBe("Clio");
});
