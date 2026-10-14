import { remoteParameterHints } from "./remote-helpers.js";
import { externalImport } from "../modules.js";
import type { Diagnostic, SourceFile } from "../index.js";
import type * as A from "../syntax/ast.js";
import { parse } from "../syntax/parse.js";
import { anyType, assignable, sameType, typeName, union } from "./types.js";
import type {
  AnalysisOptions,
  AnalysisResult,
  FunctionInfo,
  FunctionType,
  ScopeInfo,
  SemanticModel,
  SemanticType,
  SymbolInfo,
  TypeValue,
} from "./types.js";

type MutableSymbol = Omit<SymbolInfo, "type"> & { type: SemanticType };
type Scope = Omit<ScopeInfo, "symbols" | "parent"> & {
  parent: Scope | null;
  symbols: Map<string, MutableSymbol>;
};
interface FunctionContext {
  node: A.Node;
  scope: Scope;
  parameters: MutableSymbol[];
  captures: Set<SymbolInfo>;
  async: boolean;
  usesParallel: boolean;
}
const number: SemanticType = { kind: "Number" },
  string: SemanticType = { kind: "String" },
  boolean: SemanticType = { kind: "Boolean" },
  voidType: SemanticType = { kind: "Void" };
const fnType = (
  parameters: readonly SemanticType[],
  returns: SemanticType = anyType,
  async = false,
): FunctionType => ({ kind: "Callable", parameters, returns, async });

class Analyzer {
  readonly diagnostics: Diagnostic[] = [];
  readonly types = new Map<A.Node, SemanticType>();
  readonly bindings = new Map<A.Node, SymbolInfo>();
  readonly scopes: Scope[] = [];
  readonly functions: FunctionInfo[] = [];
  readonly exports = new Map<string, SymbolInfo>();
  readonly imports: string[] = [];
  readonly contexts: FunctionContext[] = [];
  readonly module: Scope;
  moduleAsync = false;
  private nextSymbol = 0;
  private readonly declarations = new Map<A.Node, MutableSymbol>();
  private readonly variableDeclarations = new Map<
    A.Assignment,
    MutableSymbol
  >();
  private readonly initialized = new Set<SymbolInfo>();
  private readonly preparing = new Set<A.Node>();
  private readonly prepared = new Set<A.Node>();
  private readonly decorated = new Map<
    A.FunctionDeclaration,
    A.DecoratedFunction
  >();
  private readonly signatures = new Set<A.FunctionDeclaration>();
  private readonly declarationScopes = new Map<A.Node, Scope>();

  constructor(
    readonly program: A.Program,
    readonly options: AnalysisOptions,
    readonly remoteParameters: ReadonlyMap<
      A.Node,
      ReadonlyMap<number, FunctionType>
    > = new Map(),
  ) {
    this.module = this.scope(null, "module");
    const primitives: SemanticType[] = [
      number,
      string,
      anyType,
      { kind: "Function" },
      { kind: "Type" },
      { kind: "ListType" },
      { kind: "Array", element: anyType },
    ];
    for (const type of primitives)
      this.declare(this.module, type.kind, "builtin", null, {
        kind: "TypeValue",
        instance: type,
        parameters: null,
      });
    for (const name of [
      "emitter",
      "range",
      "slice",
      "remote",
      "register",
      "help",
      "describe",
      "returns",
      "check",
      "params",
      "includes",
      "f",
    ]) {
      this.declare(
        this.module,
        name,
        "builtin",
        null,
        name === "f" ? fnType([], string) : anyType,
      );
    }
    for (const [name, type] of Object.entries(options.globals ?? {})) {
      const existing = this.module.symbols.get(name);
      if (existing) existing.type = type;
      else this.declare(this.module, name, "external", null, type);
    }
  }
  private scope(
    parent: Scope | null,
    kind: ScopeInfo["kind"],
    node: A.Node = this.program,
  ): Scope {
    const scope: Scope = {
      id: this.scopes.length,
      span: node.span,
      parent,
      kind,
      symbols: new Map(),
    };
    this.scopes.push(scope);
    return scope;
  }
  private report(
    code: string,
    message: string,
    node: A.Node,
    severity: Diagnostic["severity"] = "error",
  ) {
    this.diagnostics.push({ code, message, severity, span: node.span });
  }
  private declare(
    scope: Scope,
    name: string,
    kind: SymbolInfo["kind"],
    node: A.Node | null,
    type: SemanticType,
  ): MutableSymbol {
    const previous = scope.symbols.get(name);
    if (
      previous &&
      previous.kind !== "builtin" &&
      previous.kind !== "external"
    ) {
      if (node)
        this.report("KAL3002", `Duplicate declaration of ${name}`, node);
      return previous;
    }
    const symbol: MutableSymbol = {
      id: this.nextSymbol++,
      name,
      kind,
      scope: scope.id,
      declaration: node,
      type,
    };
    scope.symbols.set(name, symbol);
    if (node) this.bindings.set(node, symbol);
    return symbol;
  }
  private lookup(scope: Scope, name: string): MutableSymbol | undefined {
    return (
      scope.symbols.get(name) ??
      (scope.parent ? this.lookup(scope.parent, name) : undefined)
    );
  }
  private resolve(scope: Scope, name: string, node: A.Node): SemanticType {
    const symbol = this.lookup(scope, name);
    if (!symbol) {
      this.report(
        "KAL3001",
        `Unresolved name ${name}; its type is unknown`,
        node,
        this.options.strictNames ? "error" : "warning",
      );
      return anyType;
    }
    this.bindings.set(node, symbol);
    for (const context of this.contexts) {
      if (
        symbol.kind === "builtin" ||
        symbol.kind === "external" ||
        symbol.declaration === context.node
      )
        continue;
      let current: Scope | null = this.scopes[symbol.scope]!;
      while (current && current !== context.scope) current = current.parent;
      if (!current) context.captures.add(symbol);
    }
    if (symbol.kind === "variable" && !this.initialized.has(symbol)) {
      const owner = (value: Scope): Scope =>
        value.kind === "block" && value.parent ? owner(value.parent) : value;
      if (owner(scope) === owner(this.scopes[symbol.scope]!))
        this.report(
          "KAL3007",
          `Cannot read ${name} before its declaration is initialized`,
          node,
        );
    }
    if (
      symbol.declaration &&
      ["TypeDeclaration", "ListDeclaration"].includes(
        (symbol.declaration as A.Statement).kind,
      )
    )
      this.prepare(symbol.declaration as A.TypeDeclaration | A.ListDeclaration);
    if (
      symbol.declaration &&
      (symbol.declaration as A.Statement).kind === "FunctionDeclaration"
    ) {
      const declaration = symbol.declaration as A.FunctionDeclaration;
      const decorated = this.decorated.get(declaration);
      if (decorated)
        this.signature(decorated, this.declarationScopes.get(declaration)!);
    }
    return symbol.type;
  }
  private typed(node: A.Node, type: SemanticType): SemanticType {
    this.types.set(node, type);
    return type;
  }
  private annotation(node: A.Expression, scope: Scope): SemanticType {
    const type = this.expression(node, scope);
    if (type.kind === "TypeValue") return type.instance;
    this.report("KAL3101", `${typeName(type)} cannot be used as a type`, node);
    return anyType;
  }
  private unwrap(statement: A.Statement): A.Statement {
    return statement.kind === "ExportDeclaration"
      ? this.unwrap(statement.declaration)
      : statement;
  }
  private predeclare(body: readonly A.Statement[], scope: Scope) {
    const collect = (value: unknown): void => {
      if (!value || typeof value !== "object") return;
      if ("kind" in value) {
        const node = value as A.Statement;
        if (
          [
            "FunctionDeclaration",
            "DecoratedFunction",
            "Conditional",
            "TypeDeclaration",
            "ListDeclaration",
            "ImportDeclaration",
          ].includes(node.kind)
        )
          return;
        if (
          node.kind === "Group" &&
          this.quickParameters(node.expression).length
        )
          return;
        if (node.kind === "Assignment" && node.target.kind === "Identifier")
          this.variableDeclarations.set(
            node,
            this.declare(
              scope,
              node.target.name,
              "variable",
              node.target,
              anyType,
            ),
          );
      }
      for (const child of Object.values(value)) collect(child);
    };
    for (const item of body) collect(item);
    for (const item of body) {
      const node = this.unwrap(item);
      const declaration =
        node.kind === "DecoratedFunction" ? node.declaration : node;
      if (node.kind === "DecoratedFunction")
        this.decorated.set(node.declaration, node);
      if (
        declaration.kind === "FunctionDeclaration" ||
        declaration.kind === "TypeDeclaration" ||
        declaration.kind === "ListDeclaration"
      ) {
        const symbol = this.declare(
          scope,
          declaration.name,
          declaration.kind === "FunctionDeclaration" ? "function" : "type",
          declaration,
          declaration.kind === "FunctionDeclaration"
            ? fnType(
                declaration.parameters.map(() => anyType),
                anyType,
                this.hasAwait(declaration.body),
              )
            : anyType,
        );
        this.declarations.set(declaration, symbol);
        this.declarationScopes.set(declaration, scope);
      }
    }
  }
  private prepare(node: A.TypeDeclaration | A.ListDeclaration) {
    if (this.prepared.has(node)) return;
    if (this.preparing.has(node)) {
      this.report(
        "KAL3102",
        `Cyclic type definition involving ${node.name}`,
        node,
      );
      return;
    }
    this.preparing.add(node);
    const scope = this.declarationScopes.get(node)!;
    const symbol = this.declarations.get(node)!;
    let value: TypeValue;
    if (node.kind === "ListDeclaration")
      value = {
        kind: "TypeValue",
        instance: {
          kind: "Array",
          element: this.annotation(node.memberType, scope),
        },
        callable: false,
        parameters: null,
      };
    else {
      const fields = new Map<string, SemanticType>();
      const parameters: SemanticType[] = [];
      for (const member of node.members) {
        if (member.name.kind !== "Identifier") {
          this.report("KAL3103", "Expected a field name", member);
          continue;
        }
        if (fields.has(member.name.name))
          this.report("KAL3002", `Duplicate field ${member.name.name}`, member);
        const type = member.annotation
          ? this.annotation(member.annotation, scope)
          : anyType;
        fields.set(member.name.name, type);
        parameters.push(type);
        this.typed(member, type);
      }
      let transferableParent = true;
      if (node.parent) {
        const parent = this.expression(node.parent, scope);
        if (parent.kind !== "TypeValue" || parent.instance.kind !== "Named")
          this.report(
            "KAL3103",
            "A parent must be a declared record type",
            node.parent,
          );
        else {
          transferableParent = parent.instance.taskRecord === true;
          // Clio's derived constructor takes its own fields before inherited fields.
          parameters.push(...(parent.parameters ?? []));
          for (const [name, type] of parent.instance.fields)
            if (!fields.has(name)) fields.set(name, type);
        }
      }
      value = {
        kind: "TypeValue",
        instance: {
          kind: "Named",
          taskRecord:
            transferableParent &&
            scope.kind === "module" &&
            this.program.body.some(
              (statement) => this.unwrap(statement) === node,
            ),
          id: `${this.program.span.file}:${scope.id}:${node.name}`,
          name: node.name,
          fields,
        },
        parameters,
      };
    }
    symbol.type = value;
    this.typed(node, value);
    this.preparing.delete(node);
    this.prepared.add(node);
  }
  private signature(node: A.DecoratedFunction, scope: Scope) {
    if (this.signatures.has(node.declaration)) return;
    this.signatures.add(node.declaration);
    let parameters = node.declaration.parameters.map(() => anyType),
      returns = anyType;
    for (const decorator of node.decorators) {
      if (
        decorator.name.length !== 1 ||
        this.lookup(scope, decorator.name[0]!)?.kind !== "builtin"
      )
        continue;
      if (decorator.name[0] === "params") {
        parameters = decorator.arguments.map((arg) =>
          this.annotation(arg, scope),
        );
        if (parameters.length !== node.declaration.parameters.length)
          this.report(
            "KAL3104",
            "@params must describe every function parameter",
            decorator,
          );
      }
      if (decorator.name[0] === "returns") {
        if (decorator.arguments.length !== 1)
          this.report("KAL3104", "@returns requires one type", decorator);
        if (decorator.arguments[0])
          returns = this.annotation(decorator.arguments[0], scope);
      }
    }
    this.declarations.get(node.declaration)!.type = fnType(
      parameters,
      returns,
      this.hasAwait(node.declaration.body),
    );
  }
  private block(body: readonly A.Statement[], scope: Scope): SemanticType {
    this.predeclare(body, scope);
    let result: SemanticType = voidType;
    for (const statement of body) result = this.statement(statement, scope);
    return result;
  }
  private function(node: A.FunctionDeclaration, scope: Scope): SemanticType {
    const symbol = this.declarations.get(node)!;
    const decorated = this.decorated.get(node);
    if (decorated) this.signature(decorated, scope);
    // Invalid redeclarations may have overwritten this predeclared signature.
    // Keep analyzing for editor diagnostics instead of crashing on missing params.
    const originalSignature =
      symbol.type.kind === "Callable"
        ? symbol.type
        : fnType(
            node.parameters.map(() => anyType),
            anyType,
            this.hasAwait(node.body),
          );
    const signature = {
      ...originalSignature,
      parameters: originalSignature.parameters.map((type, index) =>
        type.kind === "Any" || type.kind === "Function"
          ? (this.remoteParameters.get(node)?.get(index) ?? type)
          : type,
      ),
    };
    const inner = this.scope(scope, "function", node.body);
    const parameters = node.parameters.map((name, index) =>
      this.declare(
        inner,
        name,
        "parameter",
        node,
        signature.parameters[index] ?? anyType,
      ),
    );
    const context: FunctionContext = {
      node,
      scope: inner,
      parameters,
      captures: new Set(),
      async: false,
      usesParallel: false,
    };
    this.contexts.push(context);
    const result = this.block(node.body.body, inner);
    this.typed(node.body, result);
    this.contexts.pop();
    if (!assignable(result, signature.returns))
      this.report(
        "KAL3105",
        `Cannot return value of type ${typeName(result)} from a function of type ${typeName(signature.returns)}`,
        node.body,
      );
    symbol.type = fnType(
      signature.parameters,
      signature.returns.kind === "Any" ? result : signature.returns,
      context.async,
    );
    this.functions.push({
      node,
      parameters,
      captures: [...context.captures],
      async: context.async,
      usesParallel: context.usesParallel,
    });
    // Parameter declarations share the function's span; its binding remains the function.
    this.bindings.set(node, symbol);
    return symbol.type;
  }
  private statement(node: A.Statement, scope: Scope): SemanticType {
    let type: SemanticType;
    switch (node.kind) {
      case "FunctionDeclaration":
        type = this.function(node, scope);
        break;
      case "DecoratedFunction":
        for (const decorator of node.decorators) {
          this.resolve(scope, decorator.name[0]!, decorator);
          if (
            this.bindings.get(decorator)?.kind !== "builtin" ||
            !["params", "returns"].includes(decorator.name.join("."))
          )
            for (const arg of decorator.arguments) this.expression(arg, scope);
        }
        type = this.function(node.declaration, scope);
        this.typed(node.declaration, type);
        break;
      case "TypeDeclaration":
      case "ListDeclaration":
        this.prepare(node);
        type = this.declarations.get(node)!.type;
        break;
      case "ImportDeclaration": {
        if (node.items.filter((item) => item.name === "*").length > 1)
          this.report(
            "KAL3004",
            "An import can have only one wildcard binding",
            node,
          );
        this.imports.push(node.path);
        const external = externalImport(node.path);
        const wholeValue = Object.hasOwn(
          this.options.moduleValues ?? {},
          node.path,
        )
          ? this.options.moduleValues![node.path]
          : undefined;
        const module = Object.hasOwn(this.options.modules ?? {}, node.path)
          ? this.options.modules![node.path]
          : undefined;
        if (!module)
          this.report(
            "KAL3004",
            `Module ${node.path} has no supplied signatures; exports are unchecked`,
            node,
            "warning",
          );
        if (!node.items.length) {
          const filename = node.path
            .split(":")
            .at(-1)!
            .split("/")
            .at(-1)!
            .replace(/\.[^.]*$/, "")
            .replace(/@.*$/, "");
          const name =
            node.alias ??
            filename
              .split(/[-._]+/)
              .filter(Boolean)
              .map((part, index) =>
                index ? part.charAt(0).toUpperCase() + part.slice(1) : part,
              )
              .join("");
          if (
            external?.kind === "esm" &&
            module &&
            !Object.hasOwn(module, "default")
          )
            this.report(
              "KAL3004",
              `Module ${node.path} does not export default`,
              node,
            );
          const imported =
            external?.kind === "esm"
              ? (module?.default ?? anyType)
              : external?.kind === "cjs"
                ? (wholeValue ?? anyType)
                : module
                  ? {
                      kind: "Named" as const,
                      id: `module:${node.path}`,
                      name: node.path,
                      fields: new Map(Object.entries(module)),
                    }
                  : anyType;
          this.declare(scope, name, "import", node, imported);
        } else
          for (const item of node.items) {
            if (item.name === "*" && !item.alias) {
              this.report("KAL3004", "Wildcard imports require an alias", item);
              continue;
            }
            const imported =
              item.name === "*"
                ? external?.kind === "cjs" &&
                  !node.items.some((item) => item.name !== "*") &&
                  wholeValue
                  ? wholeValue
                  : module
                    ? {
                        kind: "Named" as const,
                        id: `module:${node.path}`,
                        name: node.path,
                        fields: new Map(
                          Object.entries(module).filter(
                            ([name]) =>
                              external?.kind === "esm" ||
                              !node.items.some((item) => item.name === name),
                          ),
                        ),
                      }
                    : anyType
                : module && Object.hasOwn(module, item.name)
                  ? module[item.name]!
                  : anyType;
            if (
              module &&
              item.name !== "*" &&
              !Object.hasOwn(module, item.name)
            )
              this.report(
                "KAL3004",
                `Module ${node.path} does not export ${item.name}`,
                item,
              );
            this.declare(
              scope,
              item.alias ?? item.name,
              "import",
              item,
              imported,
            );
          }
        type = voidType;
        break;
      }
      case "ExportDeclaration": {
        type = this.statement(node.declaration, scope);
        const declaration = this.unwrap(node.declaration);
        const target =
          declaration.kind === "DecoratedFunction"
            ? declaration.declaration
            : declaration.kind === "Assignment"
              ? declaration.target
              : declaration;
        let symbol = this.bindings.get(target);
        if (!symbol && target.kind === "Identifier") {
          symbol = this.declare(
            scope,
            target.name,
            "external",
            target,
            anyType,
          );
        }
        if (scope !== this.module)
          this.report("KAL3005", "Exports must be at module scope", node);
        else if (!symbol || !("name" in target))
          this.report(
            "KAL3005",
            "Expected a named declaration or binding to export",
            node,
          );
        else if (this.exports.has(symbol.name))
          this.report("KAL3005", `Duplicate export ${symbol.name}`, node);
        else this.exports.set(symbol.name, symbol);
        break;
      }
      case "Conditional": {
        const results = node.branches.map((branch) => {
          if (branch.condition) this.expression(branch.condition, scope);
          const result = this.block(
            branch.body.body,
            this.scope(scope, "block", branch.body),
          );
          this.typed(branch.body, result);
          this.typed(branch, result);
          return result;
        });
        if (node.branches.at(-1)?.condition !== null) results.push(voidType);
        type = union(results);
        break;
      }
      default:
        type = this.expression(node, scope);
    }
    return this.typed(node, type);
  }
  private effect(parallel = false) {
    const context = this.contexts.at(-1);
    if (parallel) {
      if (context) context.usesParallel = true;
    } else if (context) context.async = true;
    else this.moduleAsync = true;
  }
  private invoke(
    type: SemanticType,
    args: readonly SemanticType[],
    node: A.Node,
    parallel = false,
  ): SemanticType {
    let result: SemanticType = anyType;
    if (type.kind === "TypeValue" && type.callable === false) {
      this.report("KAL3107", "A list type is not a callable constructor", node);
      return anyType;
    }
    if (type.kind === "Callable" || type.kind === "TypeValue") {
      const parameters = type.parameters;
      args.forEach((actual, index) => {
        const expected = parameters?.[index];
        if (expected && !assignable(actual, expected))
          this.report(
            "KAL3106",
            `Argument of type ${typeName(actual)} at position ${index} does not satisfy parameter of type ${typeName(expected)}`,
            node,
          );
      });
      result =
        type.kind === "Callable"
          ? type.async
            ? { kind: "Promise", element: this.unwrapPromise(type.returns) }
            : type.returns
          : type.instance;
    } else if (type.kind !== "Any" && type.kind !== "Function")
      this.report(
        "KAL3107",
        `Value of type ${typeName(type)} is not callable`,
        node,
      );
    if (parallel) {
      this.effect(true);
      return result.kind === "Promise"
        ? result
        : { kind: "Promise", element: result };
    }
    return result;
  }
  private awaited(type: SemanticType, all: boolean): SemanticType {
    this.effect();
    if (all)
      return type.kind === "Array" || type.kind === "Range"
        ? {
            kind: "Array",
            element: this.unwrapPromise(type.element),
          }
        : anyType;
    return this.unwrapPromise(type);
  }
  private pipelineTarget(
    node: A.Expression,
    scope: Scope,
    input: SemanticType,
  ): SemanticType {
    if (node.kind === "Await")
      return this.typed(
        node,
        this.awaited(
          this.pipelineTarget(node.argument, scope, input),
          node.all,
        ),
      );
    const callee = node.kind === "Call" ? node.callee : node;
    const args =
      node.kind === "Call"
        ? node.arguments
            .filter((arg) => !(arg.kind === "Group" && arg.expression === null))
            .map((arg) => this.expression(arg, scope))
        : [];
    const type = this.expression(callee, scope);
    const result = this.invoke(
      type,
      [input, ...args],
      node,
      callee.kind === "ParallelReference",
    );
    // A bare target is also the callee node: retain its callable/constructor type.
    return node.kind === "Call" ? this.typed(node, result) : result;
  }
  private unwrapPromise(type: SemanticType): SemanticType {
    if (type.kind === "Promise") return this.unwrapPromise(type.element);
    if (type.kind === "Union")
      return union(type.members.map((member) => this.unwrapPromise(member)));
    return type;
  }
  private hasAwait(value: unknown): boolean {
    if (!value || typeof value !== "object") return false;
    if ("kind" in value) {
      const node = value as A.Statement;
      if (node.kind === "Await") return true;
      if (
        node.kind === "FunctionDeclaration" ||
        node.kind === "DecoratedFunction"
      )
        return false;
      if (node.kind === "Group" && this.quickParameters(node.expression).length)
        return false;
    }
    return Object.values(value).some((child) => this.hasAwait(child));
  }
  private quickParameters(expression: A.Expression | null): string[] {
    const names = new Set<string>();
    const collect = (value: unknown): void => {
      if (!value || typeof value !== "object") return;
      if ("kind" in value && value.kind === "Group") return;
      if ("kind" in value && value.kind === "Parameter")
        names.add((value as A.Parameter).name);
      for (const child of Object.values(value)) collect(child);
    };
    collect(expression);
    return [...names];
  }
  private expression(node: A.Expression, scope: Scope): SemanticType {
    let type: SemanticType = anyType;
    switch (node.kind) {
      case "Literal":
        type =
          node.value === null
            ? { kind: "Null" }
            : typeof node.value === "number"
              ? number
              : typeof node.value === "string"
                ? string
                : boolean;
        break;
      case "Identifier":
        type = this.resolve(scope, node.name, node);
        break;
      case "Parameter": {
        const context = this.contexts.at(-1);
        const symbol =
          context?.scope.kind === "quick-function"
            ? context.scope.symbols.get(node.name)
            : undefined;
        if (!symbol)
          this.report(
            "KAL3006",
            `Quick-function parameter @${node.name} requires a surrounding group`,
            node,
          );
        else {
          this.bindings.set(node, symbol);
          type = symbol.type;
        }
        break;
      }
      case "Group": {
        if (!node.expression) {
          type = voidType;
          break;
        }
        const names = this.quickParameters(node.expression);
        if (!names.length) {
          type = this.expression(node.expression, scope);
          break;
        }
        const inner = this.scope(scope, "quick-function", node);
        const parameters = [...names].map((name) =>
          this.declare(inner, name, "parameter", node, anyType),
        );
        const context: FunctionContext = {
          node,
          scope: inner,
          parameters,
          captures: new Set(),
          async: false,
          usesParallel: false,
        };
        this.contexts.push(context);
        this.predeclare([node.expression], inner);
        const result = this.expression(node.expression, inner);
        this.contexts.pop();
        type = fnType(
          parameters.map((parameter) => parameter.type),
          result,
          context.async,
        );
        this.functions.push({
          node,
          parameters,
          captures: [...context.captures],
          async: context.async,
          usesParallel: context.usesParallel,
        });
        this.bindings.delete(node);
        break;
      }
      case "Array":
      case "Set":
        type = {
          kind: node.kind,
          element: union(
            node.elements.map((item) => this.expression(item, scope)),
          ),
        };
        break;
      case "Hashmap":
        for (const entry of node.entries)
          this.typed(entry, this.expression(entry.value, scope));
        type = { kind: "Object" };
        break;
      case "Member": {
        const object = this.expression(node.object, scope);
        if (object.kind === "Callable" && node.property === "parallel") {
          type = { ...object, async: true };
          this.effect(true);
        } else if (object.kind === "Named") {
          type = object.fields.get(node.property) ?? anyType;
          if (!object.fields.has(node.property))
            this.report(
              "KAL3108",
              `${object.name} has no member ${node.property}`,
              node,
            );
        }
        break;
      }
      case "Slice": {
        const object = this.expression(node.object, scope);
        const indices = node.indices.map((index) =>
          this.expression(index, scope),
        );
        type =
          object.kind === "Array"
            ? indices.at(-1)?.kind === "Number"
              ? object.element
              : anyType
            : object.kind === "String"
              ? string
              : anyType;
        break;
      }
      case "Range":
        for (const bound of [node.start, node.end, node.step])
          if (bound) this.expression(bound, scope);
        type = { kind: "Range", element: number };
        break;
      case "Unary":
        this.expression(node.argument, scope);
        type = boolean;
        break;
      case "Comparison":
        for (const operand of node.operands) this.expression(operand, scope);
        type = boolean;
        break;
      case "Binary": {
        const left = this.expression(node.left, scope),
          right = this.expression(node.right, scope);
        if (node.operator === "in") type = boolean;
        else if (node.operator === "and" || node.operator === "or")
          type = union([left, right]);
        else if (left.kind !== "Any" && right.kind !== "Any") {
          const valid =
            sameType(left, right) &&
            (left.kind === "Number" ||
              (node.operator === "+" && left.kind === "String"));
          if (!valid) {
            const a = typeName(left),
              b = typeName(right);
            const messages: Record<string, string> = {
              "+": `Cannot add ${a} and ${b}`,
              "-": `Cannot subtract ${b} from ${a}`,
              "*": `Cannot multiply ${a} by ${b}`,
              "/": `Cannot divide ${a} by ${b}`,
              "**": `Cannot calculate ${a} to the power of ${b}`,
              "%": `Cannot apply % to ${a} and ${b}`,
            };
            this.report(
              "KAL3109",
              messages[node.operator] ?? "Invalid arithmetic operands",
              node,
            );
          } else type = left;
        }
        break;
      }
      case "Call": {
        const callee = this.expression(node.callee, scope);
        const args = node.arguments
          .filter((arg) => !(arg.kind === "Group" && arg.expression === null))
          .map((arg) => this.expression(arg, scope));
        type = this.invoke(
          callee,
          args,
          node,
          node.callee.kind === "ParallelReference",
        );
        break;
      }
      case "ParallelReference":
        type = this.resolve(scope, node.name, node);
        if (type.kind === "Callable") type = { ...type, async: true };
        this.effect(true);
        break;
      case "MethodReference":
        break; // The receiver supplies the method at runtime, not the lexical scope.
      case "Await":
        type = this.awaited(this.expression(node.argument, scope), node.all);
        break;
      case "Pipeline": {
        const input = this.expression(node.input, scope);
        if (!node.map) type = this.pipelineTarget(node.target, scope, input);
        else {
          if (!["Array", "Range", "Any"].includes(input.kind))
            this.report(
              "KAL3110",
              `Cannot map a function to an argument of type ${typeName(input)}`,
              node.input,
            );
          // Await on a mapped pipe wraps the map result, not each invocation.
          const target =
            node.target.kind === "Await" ? node.target.argument : node.target;
          const element = this.pipelineTarget(
            target,
            scope,
            input.kind === "Array" || input.kind === "Range"
              ? input.element
              : anyType,
          );
          type = { kind: input.kind === "Range" ? "Range" : "Array", element };
          if (node.target.kind === "Await")
            type = this.awaited(type, node.target.all);
        }
        break;
      }
      case "Assignment": {
        const value = this.expression(node.value, scope);
        const expected = node.annotation
          ? this.annotation(node.annotation, scope)
          : value;
        if (!assignable(value, expected))
          this.report(
            "KAL3111",
            `Cannot assign value of type ${typeName(value)} to identifier ${node.target.kind === "Identifier" ? node.target.name : "target"} of type ${typeName(expected)}`,
            node,
          );
        if (node.target.kind === "Identifier") {
          const symbol =
            this.variableDeclarations.get(node) ??
            this.declare(
              scope,
              node.target.name,
              "variable",
              node.target,
              expected,
            );
          symbol.type = expected;
          this.initialized.add(symbol);
          this.bindings.set(node.target, symbol);
          this.bindings.set(node, symbol);
          this.typed(node.target, expected);
        } else {
          const target = this.expression(node.target, scope);
          if (!assignable(value, target))
            this.report(
              "KAL3111",
              `Cannot assign ${typeName(value)} to ${typeName(target)}`,
              node,
            );
        }
        type = expected;
        break;
      }
      case "FormattedString": {
        const tag = this.expression(node.tag, scope);
        const args = node.parts.map((part) =>
          this.typed(
            part,
            part.kind === "StringPart"
              ? string
              : part.expression
                ? this.expression(part.expression, scope)
                : { kind: "Null" },
          ),
        );
        type = this.invoke(tag, args, node);
        break;
      }
    }
    return this.typed(node, type);
  }
  run(): SemanticModel {
    this.block(this.program.body, this.module);
    return {
      types: this.types,
      bindings: this.bindings,
      scopes: this.scopes.map((scope) => ({
        ...scope,
        parent: scope.parent?.id ?? null,
      })),
      functions: this.functions,
      exports: this.exports,
      imports: this.imports,
      moduleAsync: this.moduleAsync,
    };
  }
}

export function analyzeProgram(
  program: A.Program,
  options: AnalysisOptions = {},
): AnalysisResult {
  let analyzer = new Analyzer(program, options);
  let model = analyzer.run();
  let previous = "[]";
  let stable = false;
  for (let pass = 0; pass < 16; pass++) {
    const hints = remoteParameterHints(program, model);
    const key = JSON.stringify(
      [...hints].map(([node, parameters]) => [
        node.span.start,
        [...parameters].map(([index, type]) => [index, type.remote]),
      ]),
    );
    if (key === previous) {
      stable = true;
      break;
    }
    previous = key;
    analyzer = new Analyzer(program, options, hints);
    model = analyzer.run();
  }
  if (!stable)
    analyzer.diagnostics.push({
      code: "KAL4302",
      severity: "error",
      span: program.span,
      message:
        "Local remote helper signatures did not stabilize within 16 analysis passes",
    });
  return {
    program,
    model,
    diagnostics: analyzer.diagnostics.sort(
      (a, b) => a.span!.start - b.span!.start,
    ),
  };
}
export function analyze(
  source: SourceFile,
  options: AnalysisOptions = {},
): AnalysisResult {
  const parsed = parse(source);
  return parsed.program ? analyzeProgram(parsed.program, options) : parsed;
}
