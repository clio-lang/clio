import { parseExpression } from "@babel/parser";
import { helperSource } from "./helpers.js";
import { generate } from "@babel/generator";
import * as t from "@babel/types";
import type {
  CompilationResult,
  Diagnostic,
  SourceFile,
  SourceSpan,
} from "../index.js";
import type {
  IRBinding,
  IRExpression,
  IRModule,
  IRStatement,
} from "../lowering/ir.js";

export interface EmissionContext {
  readonly captureReaders?: readonly { key: string; binding: IRBinding }[];
  readonly task?: {
    name: string;
    captures: readonly IRBinding[];
    captureKeys: readonly string[];
    root: IRBinding;
  };
  readonly sources?: readonly SourceFile[];
}

/** The sole compiler layer that depends on Babel. */
export function emitJavaScript(
  module: IRModule,
  source: SourceFile,
  sharedHelpers?: string,
  parallelBridge?: string,
  context: EmissionContext = {},
): CompilationResult {
  const diagnostics: Diagnostic[] = [];
  const names = new Map<number, string>();
  const used = new Set(module.reservedNames);
  let nextName = 0;
  const fresh = () => {
    let name: string;
    do {
      name = `__kalandra${nextName++}`;
    } while (used.has(name));
    used.add(name);
    return name;
  };
  const name = (binding: IRBinding) => {
    if (!names.has(binding.id)) names.set(binding.id, fresh());
    return names.get(binding.id)!;
  };
  let helperName: string | undefined;
  let parallelName: string | undefined;
  const helperPath = "kalandra:compatibility-helpers.js";
  const sourceFiles = context.sources ?? [source];
  const sourceTexts = Object.fromEntries(
    sourceFiles.map((file) => [file.path, file.text]),
  );
  const sourceLines = new Map(
    sourceFiles.map((file) => {
      const starts = [0];
      for (let offset = 0; offset < file.text.length; offset++)
        if (file.text[offset] === "\n") starts.push(offset + 1);
      return [file.path, starts] as const;
    }),
  );
  const position = (offset: number, file: string) => {
    const lineStarts = sourceLines.get(file) ?? [0];
    let lo = 0,
      hi = lineStarts.length;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >>> 1;
      if (lineStarts[mid]! <= offset) lo = mid;
      else hi = mid;
    }
    return { line: lo + 1, column: offset - lineStarts[lo]!, index: offset };
  };
  const located = <N extends t.Node>(
    node: N,
    span: SourceSpan,
    identifierName?: string,
  ): N => {
    node.loc = {
      start: position(span.start, span.file),
      end: position(span.end, span.file),
      filename: span.file,
      identifierName,
    };
    return node;
  };
  const ref = (binding: IRBinding, span: SourceSpan) =>
    located(t.identifier(name(binding)), span, binding.name);
  function expression(node: IRExpression): t.Expression {
    let result: t.Expression;
    switch (node.kind) {
      case "Parallel":
        parallelName ??= fresh();
        result = t.callExpression(t.identifier(parallelName), [
          t.memberExpression(
            t.newExpression(t.identifier("URL"), [
              t.stringLiteral(node.module),
              t.memberExpression(
                t.metaProperty(t.identifier("import"), t.identifier("meta")),
                t.identifier("url"),
              ),
            ]),
            t.identifier("href"),
          ),
          t.stringLiteral(node.exportName),
          t.valueToNode(node.schema),
          t.valueToNode(node.captures ?? []),
          t.stringLiteral(node.recordScope ?? ""),
        ]);
        break;
      case "Undefined":
        result = t.unaryExpression("void", t.numericLiteral(0));
        break;
      case "Literal":
        result =
          node.value === null
            ? t.nullLiteral()
            : typeof node.value === "string"
              ? t.stringLiteral(node.value)
              : typeof node.value === "boolean"
                ? t.booleanLiteral(node.value)
                : node.value < 0 || Object.is(node.value, -0)
                  ? t.unaryExpression("-", t.numericLiteral(-node.value))
                  : t.numericLiteral(node.value);
        break;
      case "Reference":
        if (node.binding) return ref(node.binding, node.span);
        if (!t.isValidIdentifier(node.name)) {
          diagnostics.push({
            code: "KAL4002",
            severity: "error",
            message: `External name ${node.name} is not a JavaScript identifier`,
            span: node.span,
          });
          result = t.unaryExpression("void", t.numericLiteral(0));
        } else result = t.identifier(node.name);
        break;
      case "Helper":
        helperName ??= fresh();
        result = t.memberExpression(
          t.identifier(helperName),
          t.identifier(node.name),
        );
        break;
      case "Index":
        result = t.memberExpression(
          expression(node.object),
          node.indices.length === 1
            ? expression(node.indices[0]!)
            : t.sequenceExpression(node.indices.map(expression)),
          true,
        );
        break;
      case "Map": {
        let callback: t.Expression;
        if (!node.arguments.length && !node.method && !node.construct)
          callback = expression(node.callee!);
        else if (!node.arguments.length && node.construct) {
          const args = t.identifier(fresh());
          callback = t.arrowFunctionExpression(
            [t.restElement(args)],
            t.newExpression(expression(node.callee!), [t.spreadElement(args)]),
          );
        } else {
          const item = t.identifier(fresh()),
            index = t.identifier(fresh()),
            iterator = t.identifier(fresh());
          let callee = node.method
            ? (item as t.Expression)
            : expression(node.callee!);
          for (const property of node.method ?? [])
            callee = t.memberExpression(callee, t.identifier(property));
          const args = node.method
            ? node.arguments.map(expression)
            : [item, ...node.arguments.map(expression), index, iterator];
          const call = node.construct
            ? t.newExpression(callee, args)
            : t.callExpression(callee, args);
          callback = t.arrowFunctionExpression(
            node.method ? [item] : [item, index, iterator],
            call,
            node.arguments.length > 0 && node.async,
          );
        }
        result = t.callExpression(
          t.memberExpression(expression(node.input), t.identifier("map")),
          [callback],
        );
        break;
      }
      case "Class": {
        const parameters = node.fields.map(() => t.identifier(fresh()));
        const body: t.Statement[] = [];
        let params: (t.Identifier | t.RestElement)[] = parameters;
        if (node.parent) {
          const args = t.identifier(fresh());
          params = [t.restElement(args)];
          body.push(
            t.expressionStatement(
              t.callExpression(t.super(), [
                t.spreadElement(
                  t.callExpression(
                    t.memberExpression(args, t.identifier("slice")),
                    [t.numericLiteral(parameters.length)],
                  ),
                ),
              ]),
            ),
          );
          if (parameters.length)
            body.push(
              t.variableDeclaration("const", [
                t.variableDeclarator(t.arrayPattern(parameters), args),
              ]),
            );
        }
        if (node.recordId) helperName ??= fresh();
        node.fields.forEach((field, index) =>
          body.push(
            t.expressionStatement(
              node.recordId
                ? t.callExpression(
                    t.memberExpression(
                      t.identifier(helperName!),
                      t.identifier("recordField"),
                    ),
                    [
                      t.thisExpression(),
                      t.stringLiteral(field),
                      parameters[index]!,
                    ],
                  )
                : t.assignmentExpression(
                    "=",
                    t.memberExpression(
                      t.thisExpression(),
                      t.stringLiteral(field),
                      true,
                    ),
                    parameters[index]!,
                  ),
            ),
          ),
        );
        const methods = [
          t.classMethod(
            "constructor",
            t.identifier("constructor"),
            params,
            t.blockStatement(body),
          ),
        ];
        if (!node.parent)
          methods.push(
            t.classMethod(
              "get",
              t.identifier("members"),
              [],
              t.blockStatement([
                t.returnStatement(t.numericLiteral(node.fields.length)),
              ]),
              false,
              true,
            ),
          );
        result = t.classExpression(
          t.identifier(t.isValidIdentifier(node.name) ? node.name : fresh()),
          node.parent ? expression(node.parent) : null,
          t.classBody(methods),
        );
        if (node.recordId) {
          helperName ??= fresh();
          result = t.callExpression(
            t.memberExpression(
              t.identifier(helperName),
              t.identifier("registerRecord"),
            ),
            [t.stringLiteral(node.recordId), result],
          );
        }
        break;
      }
      case "Array":
        result = t.arrayExpression(node.elements.map(expression));
        break;
      case "Set":
        result = t.newExpression(t.identifier("Set"), [
          t.arrayExpression(node.elements.map(expression)),
        ]);
        break;
      case "Object":
        result = t.objectExpression(
          node.entries.map((entry) =>
            t.objectProperty(
              t.stringLiteral(entry.key),
              expression(entry.value),
            ),
          ),
        );
        break;
      case "Member":
        result = t.memberExpression(
          expression(node.object),
          t.identifier(node.property),
        );
        break;
      case "Binary":
        result =
          node.operator === "and" || node.operator === "or"
            ? t.logicalExpression(
                node.operator === "and" ? "&&" : "||",
                expression(node.left),
                expression(node.right),
              )
            : t.binaryExpression(
                node.operator as t.BinaryExpression["operator"],
                expression(node.left),
                expression(node.right),
              );
        break;
      case "Not":
        result = t.unaryExpression("!", expression(node.argument));
        break;
      case "Comparison": {
        const comparisons = node.operators.map((operator, index) =>
          t.binaryExpression(
            operator as t.BinaryExpression["operator"],
            expression(node.operands[index]!),
            expression(node.operands[index + 1]!),
          ),
        );
        // Clio repeats middle operands and short-circuits each comparison.
        result = comparisons
          .slice(1)
          .reduce<t.Expression>(
            (left, right) => t.logicalExpression("&&", left, right),
            comparisons[0]!,
          );
        break;
      }
      case "Call":
        result = node.construct
          ? t.newExpression(
              expression(node.callee),
              node.arguments.map(expression),
            )
          : t.callExpression(
              expression(node.callee),
              node.arguments.map(expression),
            );
        break;
      case "Function": {
        // Each iteration has fresh lexical parameter bindings, so escaped closures
        // retain their invocation's values. State is private to this invocation.
        const state = node.tailRecursive
          ? node.parameters.map(() => t.identifier(fresh()))
          : undefined;
        const body = statements(node.body, state);
        result = t.arrowFunctionExpression(
          state ??
            node.parameters.map((parameter) => ref(parameter, node.span)),
          t.blockStatement(
            state
              ? [
                  t.whileStatement(
                    t.booleanLiteral(true),
                    t.blockStatement([
                      ...node.parameters.map((parameter, index) =>
                        t.variableDeclaration("const", [
                          t.variableDeclarator(
                            ref(parameter, node.span),
                            state[index]!,
                          ),
                        ]),
                      ),
                      ...body,
                      t.returnStatement(),
                    ]),
                  ),
                ]
              : body,
          ),
          node.async,
        );
        break;
      }
      case "Await":
        result = t.awaitExpression(
          node.all
            ? t.callExpression(
                t.memberExpression(
                  t.identifier("Promise"),
                  t.identifier("all"),
                ),
                [expression(node.argument)],
              )
            : expression(node.argument),
        );
        break;
      case "Store":
        result = t.assignmentExpression(
          "=",
          expression(node.target) as t.MemberExpression,
          expression(node.value),
        );
        break;
    }
    return located(
      result,
      node.span,
      node.kind === "Reference" ? node.name : undefined,
    );
  }
  function statements(
    nodes: readonly IRStatement[],
    tailState?: readonly t.Identifier[],
  ): t.Statement[] {
    return nodes.flatMap((node): t.Statement[] => {
      let result: t.Statement;
      switch (node.kind) {
        case "Import": {
          if (node.mode === "esm") {
            const selected = node.bindings.filter(
              (item) => item.imported !== "*",
            );
            const namespace = node.bindings.filter(
              (item) => item.imported === "*",
            );
            const imports: t.Statement[] = [];
            if (selected.length)
              imports.push(
                t.importDeclaration(
                  selected.map((item) =>
                    t.importSpecifier(
                      ref(item.binding, node.span),
                      t.identifier(item.imported),
                    ),
                  ),
                  t.stringLiteral(node.path),
                ),
              );
            for (const item of namespace)
              imports.push(
                t.importDeclaration(
                  [t.importNamespaceSpecifier(ref(item.binding, node.span))],
                  t.stringLiteral(node.path),
                ),
              );
            return imports.map((item) => located(item, node.span));
          }
          const namespace = t.identifier(fresh());
          const declaration = t.importDeclaration(
            [
              node.mode === "cjs"
                ? t.importDefaultSpecifier(namespace)
                : t.importNamespaceSpecifier(namespace),
            ],
            t.stringLiteral(node.path),
          );
          const selected = node.bindings.filter(
            (item) => item.imported !== "*",
          );
          const rest = node.bindings.filter((item) => item.imported === "*");
          const properties: (t.ObjectProperty | t.RestElement)[] = selected.map(
            (item) =>
              t.objectProperty(
                t.stringLiteral(item.imported),
                ref(item.binding, node.span),
              ),
          );
          if (rest.length && selected.length)
            properties.push(t.restElement(ref(rest[0]!.binding, node.span)));
          const locals: t.Statement[] = properties.length
            ? [
                t.variableDeclaration("const", [
                  t.variableDeclarator(t.objectPattern(properties), namespace),
                ]),
              ]
            : [];
          if (!selected.length)
            for (const item of rest)
              locals.push(
                t.variableDeclaration("const", [
                  t.variableDeclarator(ref(item.binding, node.span), namespace),
                ]),
              );
          return [declaration, ...locals].map((item) =>
            located(item, node.span),
          );
        }
        case "Bind":
          result = t.variableDeclaration("const", [
            t.variableDeclarator(
              ref(node.binding, node.span),
              expression(node.value),
            ),
          ]);
          break;
        case "Effect":
          result = t.expressionStatement(expression(node.value));
          break;
        case "TailCall":
          if (!tailState)
            throw new Error("Tail call outside optimized function");
          return [
            located(
              t.expressionStatement(
                t.assignmentExpression(
                  "=",
                  t.arrayPattern([...tailState]),
                  t.arrayExpression(node.arguments.map(expression)),
                ),
              ),
              node.span,
            ),
            located(t.continueStatement(), node.span),
          ];
        case "Return":
          result = t.returnStatement(expression(node.value));
          break;
        case "If": {
          let alternate: t.Statement | null = null;
          for (const branch of [...node.branches].reverse()) {
            const body = t.blockStatement(statements(branch.body, tailState));
            alternate = branch.condition
              ? located(
                  t.ifStatement(expression(branch.condition), body, alternate),
                  node.span,
                )
              : body;
          }
          result = alternate!;
          break;
        }
        case "Export": {
          const value = expression(node.value);
          const local =
            node.value.kind === "Reference" && node.value.binding
              ? (value as t.Identifier)
              : t.identifier(fresh());
          const declaration = t.exportNamedDeclaration(null, [
            t.exportSpecifier(local, t.identifier(node.name)),
          ]);
          if (!(node.value.kind === "Reference" && node.value.binding))
            return [
              located(
                t.variableDeclaration("const", [
                  t.variableDeclarator(local, value),
                ]),
                node.span,
              ),
              located(declaration, node.span),
            ];
          result = declaration;
          break;
        }
      }
      return [located(result, node.span)];
    });
  }
  let body = statements(module.body);
  if (context.task) {
    if (!parallelBridge) throw new Error("Task scopes require a dispatcher");
    const task = context.task;
    const args = t.identifier(fresh());
    const dispatch = t.identifier(fresh());
    const scope = t.identifier(fresh());
    const handle = t.identifier(parallelName ?? fresh());
    parallelName = undefined; // Task-local handle parameter, never the parent module's session.
    const captures = task.captures.map((binding, index) =>
      t.variableDeclaration("const", [
        t.variableDeclarator(
          t.identifier(name(binding)),
          t.memberExpression(args, t.numericLiteral(index), true),
        ),
      ]),
    );
    const invoke = t.arrowFunctionExpression(
      [handle],
      t.blockStatement([
        ...body,
        t.returnStatement(
          t.callExpression(t.identifier(name(task.root)), [
            t.spreadElement(
              t.callExpression(
                t.memberExpression(args, t.identifier("slice")),
                [t.numericLiteral(task.captures.length)],
              ),
            ),
          ]),
        ),
      ]),
    );
    const readers = t.arrayExpression(
      task.captures.map((binding, index) =>
        t.arrayExpression([
          t.stringLiteral(task.captureKeys[index]!),
          t.arrowFunctionExpression([], t.identifier(name(binding))),
        ]),
      ),
    );
    body = [
      t.importDeclaration(
        [t.importSpecifier(scope, t.identifier("withTaskDispatch"))],
        t.stringLiteral(parallelBridge),
      ),
      t.exportNamedDeclaration(
        t.functionDeclaration(
          t.identifier(task.name),
          [dispatch, t.restElement(args)],
          t.blockStatement([
            ...captures,
            t.returnStatement(
              t.callExpression(scope, [dispatch, readers, invoke]),
            ),
          ]),
        ),
      ),
    ];
  }
  if (context.captureReaders?.length) {
    if (!parallelBridge)
      throw new Error("Capture readers require a project dispatcher");
    const register = t.identifier(fresh());
    body.unshift(
      t.importDeclaration(
        [t.importSpecifier(register, t.identifier("registerCapture"))],
        t.stringLiteral(parallelBridge),
      ),
      ...context.captureReaders.map(({ key, binding }) =>
        t.expressionStatement(
          t.callExpression(register, [
            t.stringLiteral(key),
            t.arrowFunctionExpression([], t.identifier(name(binding))),
          ]),
        ),
      ),
    );
  }
  if (parallelName) {
    if (!parallelBridge)
      throw new Error("Parallel IR requires a project dispatcher");
    body.unshift(
      t.importDeclaration(
        [t.importSpecifier(t.identifier(parallelName), t.identifier("handle"))],
        t.stringLiteral(parallelBridge),
      ),
    );
  }
  if (helperName && sharedHelpers)
    body.unshift(
      t.importDeclaration(
        [t.importDefaultSpecifier(t.identifier(helperName))],
        t.stringLiteral(sharedHelpers),
      ),
    );
  else if (helperName)
    body.unshift(
      t.variableDeclaration("const", [
        t.variableDeclarator(
          t.identifier(helperName),
          parseExpression(helperSource, { sourceFilename: helperPath }),
        ),
      ]),
    );
  const ast = t.program(body, [], "module");
  if (diagnostics.length) return { diagnostics };
  const output = generate(
    ast,
    { sourceMaps: true, sourceFileName: source.path, comments: false },
    helperName && !sharedHelpers
      ? { ...sourceTexts, [helperPath]: helperSource }
      : sourceTexts,
  );
  return {
    diagnostics,
    output: { code: output.code, sourceMap: JSON.stringify(output.map) },
  };
}
