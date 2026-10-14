import { localHelpers } from "./semantic/remote-helpers.js";
import { remoteRecordScope } from "../../protocol/src/remote-records.js";
import { remoteTaskModule } from "../../protocol/src/remote-contract.js";
import type { RemoteClientManifest } from "../../protocol/src/remote-contract.js";
import type { WireType } from "../../protocol/src/schema.js";
import type { Diagnostic } from "./index.js";
import type {
  FunctionType,
  SemanticModel,
  SemanticType,
} from "./semantic/types.js";
import type {
  Node,
  Program,
  Expression,
  Block,
  Call,
  FunctionDeclaration,
} from "./syntax/ast.js";
import type { ParallelTarget } from "./parallel.js";

function semantic(
  type: WireType,
  manifest: RemoteClientManifest,
): SemanticType {
  if (typeof type === "string")
    return {
      kind: (
        {
          number: "Number",
          string: "String",
          boolean: "Boolean",
          null: "Null",
          void: "Void",
        } as const
      )[type],
    };
  if ("array" in type)
    return { kind: "Array", element: semantic(type.array, manifest) };
  if ("union" in type)
    return {
      kind: "Union",
      members: type.union.map((type) => semantic(type, manifest)),
    };
  return {
    kind: "Named",
    id: remoteRecordScope(manifest.revision) + type.record.id,
    name: manifest.records?.[type.record.id]?.name ?? type.record.id,
    taskRecord: true,
    fields: new Map(
      type.record.fields.map(([name, field]) => [
        name,
        semantic(field, manifest),
      ]),
    ),
  };
}
export function remoteSignatures(
  contract: string,
  manifest: RemoteClientManifest,
): Record<string, SemanticType> {
  const constructors = remoteConstructors(manifest);
  return Object.fromEntries([
    ...Object.entries(manifest.types ?? {}).map(
      ([name, id]) => [name, constructors.get(id)!] as const,
    ),
    ...Object.entries(manifest.services).map(([id, service]) => [
      id,
      {
        kind: "Callable",
        parameters: service.signature.args.map((type) =>
          semantic(type, manifest),
        ),
        returns: semantic(service.signature.result, manifest),
        async: true,
        remote: {
          module: remoteTaskModule(contract, id),
          exportName: service.exportName,
          recordScope: remoteRecordScope(manifest.revision),
          signature: service.signature,
          schemas: service.schemas,
        },
      } satisfies FunctionType,
    ]),
  ]);
}
export function remoteType(
  type: SemanticType | undefined,
): FunctionType | undefined {
  return type?.kind === "Callable" && type.remote ? type : undefined;
}
/** Local identity aliases are compile-time bindings; all value escapes remain checked. */
export function remoteTargets(program: Program, model: SemanticModel) {
  const targets = new Map<Node, ParallelTarget>();
  const diagnostics: Diagnostic[] = [];
  const aliases = new Set<Node>();
  const localValues = new Set<Node>();
  const helpers = localHelpers(program, model);
  const helperCalls = new Set([...helpers.values()].flat());
  const localAssignments = new Set<Node>();
  const allow = (node: Expression) => {
    localValues.add(node);
    if (node.kind === "Group" && node.expression) allow(node.expression);
  };
  for (const [node, calls] of helpers) {
    const fn = node as FunctionDeclaration;
    const signature = model.bindings.get(fn)?.type;
    if (signature?.kind !== "Callable") continue;
    if (remoteType(signature.returns)) {
      const last = fn.body.body.at(-1) as Expression | undefined;
      if (
        last &&
        ["Identifier", "Member", "Group", "Call"].includes(last.kind) &&
        remoteType(model.types.get(last))
      )
        allow(last);
    }
    for (const call of calls) {
      const args = call.arguments.filter(
        (arg) => !(arg.kind === "Group" && arg.expression === null),
      );
      for (const [index, arg] of args.entries()) {
        const expected = remoteType(signature.parameters[index])?.remote;
        const actual = remoteType(model.types.get(arg))?.remote;
        if (
          expected &&
          actual &&
          JSON.stringify(expected) === JSON.stringify(actual)
        )
          allow(arg);
      }
    }
  }
  const localResult = (node: Expression): boolean =>
    node.kind === "Call"
      ? helperCalls.has(node) && !!remoteType(model.types.get(node))
      : node.kind === "Group" &&
        !!node.expression &&
        localResult(node.expression);

  // Only erase standalone, non-returning bindings with side-effect-free identity RHSs.
  // Calls, computed properties, exports and bindings used as expression values stay diagnostic.
  const identity = (node: Expression): boolean => {
    if (node.kind === "Identifier" || node.kind === "ParallelReference")
      return !!model.bindings.get(node);
    if (node.kind === "Group")
      return !!node.expression && identity(node.expression);
    if (node.kind === "Member") return identity(node.object);
    return false;
  };
  function collect(value: unknown) {
    if (!value || typeof value !== "object") return;
    const node = value as Program | Block;
    if (node.kind === "Program" || node.kind === "Block") {
      for (const [index, statement] of node.body.entries()) {
        if (
          statement.kind === "Assignment" &&
          statement.target.kind === "Identifier" &&
          (node.kind === "Program" || index < node.body.length - 1) &&
          remoteType(model.types.get(statement)) &&
          remoteType(model.types.get(statement.value)) &&
          identity(statement.value)
        )
          aliases.add(statement);
        if (
          statement.kind === "Assignment" &&
          statement.target.kind === "Identifier" &&
          (node.kind === "Program" || index < node.body.length - 1) &&
          remoteType(model.types.get(statement)) &&
          localResult(statement.value)
        ) {
          localAssignments.add(statement);
          allow(statement.value);
        }
      }
    }
    for (const child of Object.values(value)) collect(child);
  }
  collect(program);
  function walk(value: unknown) {
    if (!value || typeof value !== "object") return;
    const node = value as Node & { kind?: string };
    if (node.kind === "ImportDeclaration" || aliases.has(node)) return;
    if (localAssignments.has(node)) {
      walk((node as import("./syntax/ast.js").Assignment).value);
      return;
    }
    if (node.kind === "Block" || node.kind === "Program") {
      for (const child of Object.values(value)) walk(child);
      return;
    }
    const type = model.types.get(node);
    if (
      (node.kind === "Identifier" || node.kind === "Member") &&
      type?.kind === "TypeValue" &&
      type.instance.kind === "Named" &&
      type.instance.id.startsWith("remote:")
    )
      return;
    const remote = remoteType(type)?.remote;
    if (remote) {
      if (!identity(node as Expression) && !localResult(node as Expression)) {
        diagnostics.push({
          code: "KAL4302",
          severity: "error",
          span: node.span,
          message:
            "Remote handle values require a direct identity or a checked synchronous local helper result",
        });
      }
      targets.set(node, {
        module: remote.module,
        exportName: remote.exportName,
        recordScope: remote.recordScope,
        ...(node.kind === "Call" ||
        (node.kind === "Group" && localResult(node as Expression))
          ? { preserveValue: true }
          : {}),
      });
      if (node.kind === "Call") {
        walk((node as Call).callee);
        for (const arg of (node as Call).arguments) walk(arg);
      } else if (node.kind === "Group" && localResult(node as Expression)) {
        const expression = (node as import("./syntax/ast.js").Group)
          .expression!;
        allow(expression);
        walk(expression);
      }
      return; // A namespace member, .parallel or grouped handle owns its children.
    }
    if (
      type?.kind === "Named" &&
      [...type.fields.values()].some((field) => remoteType(field))
    ) {
      diagnostics.push({
        code: "KAL4302",
        severity: "error",
        span: node.span,
        message:
          "Remote namespaces must be used through statically named service calls",
      });
      return;
    }
    for (const child of Object.values(value)) walk(child);
  }
  walk(program);
  return { targets, diagnostics, aliases, localValues };
}
export function remoteConstructors(manifest: RemoteClientManifest) {
  const types = new Map<string, import("./semantic/types.js").TypeValue>();
  function get(id: string): import("./semantic/types.js").TypeValue {
    const saved = types.get(id);
    if (saved) return saved;
    const record = manifest.records![id]!;
    const parent = record.parent ? get(record.parent) : undefined;
    const fields = new Map(
      record.fields.map(([name, type]) => [name, semantic(type, manifest)]),
    );
    if (parent?.instance.kind === "Named")
      for (const [name, type] of parent.instance.fields)
        if (!fields.has(name)) fields.set(name, type);
    const type: import("./semantic/types.js").TypeValue = {
      kind: "TypeValue",
      instance: {
        kind: "Named",
        id: remoteRecordScope(manifest.revision) + id,
        name: record.name,
        taskRecord: true,
        fields,
      },
      parameters: [
        ...record.fields.map(([, type]) => semantic(type, manifest)),
        ...(parent?.parameters ?? []),
      ],
    };
    types.set(id, type);
    return type;
  }
  for (const id of Object.keys(manifest.records ?? {})) get(id);
  return types;
}
