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

test("Scope.extend should work with Scopes", () => {
  const outerScope = new Scope({ lang: "Clio" });
  const scope = new Scope({});
  scope.extend(outerScope);
  expect(scope.$.lang).toBe("Clio");
});

test("Scope.extend should work with Objects", () => {
  const outerScope = { lang: "Clio" };
  const scope = new Scope({});
  scope.extend(outerScope);
  expect(scope.$.lang).toBe("Clio");
});

test("Scope.extend should respect prefix", () => {
  const outerScope = { lang: "Clio" };
  const scope = new Scope({});
  scope.extend(outerScope, null, "clio");
  expect(scope.$.clio.lang).toBe("Clio");
});

test("Scope.extend should respect key renames", () => {
  const outerScope = { lang: "Clio" };
  const scope = new Scope({});
  scope.extend(outerScope, { lang: "language" });
  expect(scope.$.language).toBe("Clio");
});
