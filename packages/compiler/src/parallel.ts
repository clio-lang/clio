import { remoteType } from "./remote-imports.js";
import type { TaskSchema } from "../../protocol/src/schema.js";
import type { Diagnostic } from "./index.js";
import type * as A from "./syntax/ast.js";
import type { SemanticModel, SymbolInfo } from "./semantic/types.js";

export interface ParallelTarget {
  readonly preserveValue?: boolean;
  readonly recordId?: string;
  readonly module: string;
  readonly exportName: string;
  readonly schema?: TaskSchema;
  readonly declarationKind?: "type";
  readonly captures?: readonly string[];
  readonly recordScope?: string;
}

type SyntaxNode =
  | A.Statement
  | A.Program
  | A.Block
  | A.Decorator
  | A.Branch
  | A.MapEntry
  | A.StringPart
  | A.Interpolation
  | A.ImportItem
  | A.TypeMember;

function nodes(
  value: unknown,
  result = new Set<SyntaxNode>(),
): Set<SyntaxNode> {
  if (!value || typeof value !== "object") return result;
  if ("kind" in value && "span" in value) result.add(value as SyntaxNode);
  for (const child of Object.values(value)) nodes(child, result);
  return result;
}

/** Extract module functions and explicitly typed data dependencies; never replay the application's initialization in workers. */
export function createParallelPlan(
  program: A.Program,
  model: SemanticModel,
  taskModule: string,
  resolveImported?: (
    node: A.Node,
  ) => { target: ParallelTarget; include(): void } | undefined,
) {
  const diagnostics: Diagnostic[] = [];
  const targets = new Map<A.Node, ParallelTarget>();
  const declarations = new Map<
    number,
    A.FunctionDeclaration | A.DecoratedFunction
  >();
  for (const statement of program.body) {
    const declaration =
      statement.kind === "ExportDeclaration"
        ? statement.declaration
        : statement;
    const fn =
      declaration.kind === "DecoratedFunction"
        ? declaration.declaration
        : declaration;
    if (fn.kind === "FunctionDeclaration")
      declarations.set(
        model.bindings.get(fn)!.id,
        declaration as A.FunctionDeclaration | A.DecoratedFunction,
      );
  }
  const lists = new Map<number, A.ListDeclaration | A.TypeDeclaration>();
  for (const statement of program.body) {
    const node =
      statement.kind === "ExportDeclaration"
        ? statement.declaration
        : statement;
    if (node.kind === "ListDeclaration" || node.kind === "TypeDeclaration")
      lists.set(model.bindings.get(node)!.id, node);
  }
  const captures = new Map<
    number,
    { symbol: SymbolInfo; node: A.Expression }
  >();
  const annotated = new Map<number, A.Expression>();
  for (const statement of program.body) {
    const node =
      statement.kind === "ExportDeclaration"
        ? statement.declaration
        : statement;
    if (
      node.kind === "Assignment" &&
      node.annotation &&
      node.target.kind === "Identifier"
    ) {
      const symbol = model.bindings.get(node.target);
      if (symbol?.declaration === node.target)
        annotated.set(symbol.id, node.target);
    }
  }
  const selectedLists = new Set<number>();
  const listOrder: (A.ListDeclaration | A.TypeDeclaration)[] = [];
  function includeList(id: number) {
    if (selectedLists.has(id)) return;
    selectedLists.add(id);
    const skipped = new Set<SyntaxNode>();
    for (const node of nodes(lists.get(id))) {
      if (skipped.has(node)) continue;
      const symbol = model.bindings.get(node);
      const imported =
        symbol?.kind === "import" || node.kind === "Member"
          ? resolveImported?.(node)
          : undefined;
      if (imported?.target.declarationKind === "type") {
        dependencies.set(node, imported.target);
        imported.include();
        if (node.kind === "Member")
          for (const child of nodes(node.object)) skipped.add(child);
        continue;
      }
      if (!symbol || symbol.kind === "builtin" || symbol.id === id) continue;
      if (lists.has(symbol.id)) includeList(symbol.id);
      else
        reject(
          node,
          "Task type declarations must use builtin types or declared local Clio types",
        );
    }
    listOrder.push(lists.get(id)!);
  }
  const selected = new Set<number>();
  const nested = new Set<number>();
  const remoteTasks = new Set<number>();
  const dependencies = new Map<A.Node, ParallelTarget>();
  const reject = (node: A.Node, message: string) =>
    diagnostics.push({
      code: "KAL4201",
      severity: "error",
      message,
      span: node.span,
    });
  const isParallel = (node: SyntaxNode) =>
    node.kind === "ParallelReference" ||
    (node.kind === "Member" &&
      node.property === "parallel" &&
      model.types.get(node.object)?.kind === "Callable");
  function include(id: number) {
    if (selected.has(id)) return;
    selected.add(id);
    const declaration = declarations.get(id)!;
    const descendants = nodes(declaration);
    const skipped = new Set<SyntaxNode>();
    for (const node of descendants) {
      if (skipped.has(node)) continue;
      if (remoteType(model.types.get(node))) {
        nested.add(id);
        remoteTasks.add(id);
        if (!["Call", "Assignment", "Group", "Block"].includes(node.kind))
          for (const child of nodes(node))
            if (child !== node) skipped.add(child);
        continue;
      }
      if (isParallel(node)) nested.add(id);
      if (node.kind === "Assignment" && resolveImported?.(node.target)) {
        reject(node, "A task cannot replace an imported function binding");
        continue;
      }
      const symbol = model.bindings.get(node);
      if (
        symbol?.kind === "import" ||
        symbol?.kind === "variable" ||
        node.kind === "Member"
      ) {
        const imported = resolveImported?.(node);
        if (imported) {
          dependencies.set(node, imported.target);
          imported.include();
          if (node.kind === "Member")
            for (const child of nodes(node.object)) skipped.add(child);
          continue;
        }
      }
      if (!symbol) {
        if (
          (node.kind === "Identifier" && model.types.has(node)) ||
          node.kind === "Decorator"
        )
          reject(
            node,
            "Parallel targets cannot reference unresolved host values",
          );
        continue;
      }
      if (symbol.kind === "builtin") continue;
      if (lists.has(symbol.id)) includeList(symbol.id);
      else if (declarations.has(symbol.id)) include(symbol.id);
      else if (
        !symbol.declaration ||
        !descendants.has(symbol.declaration as SyntaxNode)
      ) {
        const capture = annotated.get(symbol.id);
        if (capture) captures.set(symbol.id, { symbol, node: capture });
        else
          reject(
            node,
            `Parallel target captures ${symbol.name}; captures require an explicitly typed module-level declaration (external imports and imported data are not supported)`,
          );
      }
    }
  }
  function selectTargets() {
    for (const node of nodes(program)) {
      if (!isParallel(node)) continue;
      if (remoteType(model.types.get(node))) continue;
      const target = node.kind === "Member" ? node.object : node;
      const symbol = model.bindings.get(target);
      if (!symbol || !declarations.has(symbol.id)) {
        const imported = resolveImported?.(target);
        if (imported && imported.target.declarationKind !== "type") {
          targets.set(node, imported.target);
          imported.include();
          continue;
        }
        reject(
          node,
          "Parallel calls require a module-level function definition or a statically resolved local Clio import",
        );
        continue;
      }
      targets.set(node, { module: taskModule, exportName: `task${symbol.id}` });
      include(symbol.id);
    }
    for (const node of nodes(program)) {
      if (
        node.kind !== "Pipeline" ||
        !node.map ||
        model.types.get(node.input)?.kind !== "Range"
      )
        continue;
      const target =
        node.target.kind === "Await" ? node.target.argument : node.target;
      const callee = target.kind === "Call" ? target.callee : target;
      if (targets.has(callee))
        reject(
          node,
          "Direct parallel mapping over a Range cannot transfer the range callback argument yet; convert the range to an array first",
        );
    }
  }
  return {
    diagnostics,
    captures,
    targets,
    selected,
    nested,
    remoteTasks,
    declarations,
    types: lists,
    selectedTypes: selectedLists,
    includeType: includeList,
    dependencies,
    include,
    selectTargets,
    get taskProgram(): A.Program {
      return {
        ...program,
        body: [
          ...listOrder,
          ...[...declarations]
            .filter(([id]) => selected.has(id))
            .map(([, declaration]) => declaration),
        ],
      };
    },
  };
}

/** Parent invocations and reentrant worker tasks each own their dispatch lifetime. */
export const parallelBridgeSource = `
import helpers from "./runtime.mjs";
import "./records.mjs";
let session;
const captures = new Map();
export function registerCapture(key, read) { captures.set(key, read); }
function makeHandle(currentSession, readers) {
  return (module, exportName, schema, keys = [], recordScope = "") => (...args) => {
    const current = currentSession();
    if (!current || current.closed) throw new Error("Parallel calls require a managed Kalandra program runner with an active invocation");
    let task;
    try {
      const values = keys.map(key => {
        const read = readers.get(key);
        if (!read) throw new Error("Missing task capture " + key);
        return read();
      });
      task = Promise.resolve(current.dispatch({
        module, exportName, args: helpers.packTaskArgs(schema, [...values, ...args], recordScope), schema
      })).then(value => helpers.unpackTaskResult(schema, value, recordScope));
    }
    catch (error) { task = Promise.reject(error); }
    current.pending.add(task);
    task.then(() => current.pending.delete(task), error => {
      current.pending.delete(task);
      current.errors.push(error);
    });
    return task;
  };
}
export const handle = makeHandle(() => session, captures);
function scope(dispatch) { return { dispatch, pending: new Set(), errors: [], closed: false }; }
async function settle(current, invoke) {
  try {
    const result = await invoke();
    while (current.pending.size) await Promise.allSettled([...current.pending]);
    if (current.errors.length) throw current.errors[0];
    return result;
  } finally { current.closed = true; }
}
export function withTaskDispatch(dispatch, readers, invoke) {
  const current = scope(dispatch);
  return settle(current, () => invoke(makeHandle(() => current, new Map(readers))));
}
export async function withDispatch(dispatch, invoke) {
  if (session) throw new Error("This program already has an active invocation");
  const current = scope(dispatch);
  session = current;
  try { return await settle(current, invoke); }
  finally { session = undefined; }
}
`;
