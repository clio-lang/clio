import { startupTargets } from "./startup-targets.js";
import { remoteCaptureBootstrap } from "./remote-captures.js";
import { serviceRecordMetadata, emitRemoteRecords } from "./remote-records.js";
import { remoteRecordScope } from "../../protocol/src/remote-records.js";
import { remoteSignatures, remoteTargets } from "./remote-imports.js";
import { remoteManifests, remoteMapSchemas } from "./remote-manifests.js";
import {
  remoteIdentifier,
  parseRemoteClientManifest,
  parseRemoteImportManifest,
  type RemoteClientManifest,
  type RemoteClientService,
} from "../../protocol/src/remote-contract.js";
import type { TaskSchema } from "../../protocol/src/schema.js";
import { emitTaskRecords } from "./task-records.js";
import { schemaKey } from "../../protocol/src/schema.js";
import { validateParallelTypes } from "./parallel-types.js";
import { createParallelPlan, parallelBridgeSource } from "./parallel.js";
import type { IRStatement, IRBinding, IRModule } from "./lowering/ir.js";
import { anyType } from "./semantic/types.js";
import { externalImport, type ExternalImport } from "./modules.js";
import type { Diagnostic, SourceFile } from "./index.js";
import type {
  ImportDeclaration,
  Program,
  Node,
  Member,
  Decorator,
} from "./syntax/ast.js";
import type {
  AnalysisOptions,
  SemanticType,
  SemanticModel,
} from "./semantic/types.js";
import { parse } from "./syntax/parse.js";
import { analyzeProgram } from "./semantic/analyze.js";
import { lower, type TaskReference } from "./lowering/lower.js";
import { emitJavaScript } from "./emitter/javascript.js";
import { helperSource } from "./emitter/helpers.js";

export interface ProjectCompileOptions extends AnalysisOptions {
  /** Explicit service ID -> public export of the entry module. No services by default. */
  readonly remoteServices?: Readonly<Record<string, string>>;
}
export interface ProjectOutput {
  readonly remoteImports?: string;
  readonly remote?: {
    readonly deployment: string;
    readonly client: string;
    readonly revision: string;
  };

  readonly entry: string;
  /** Portable managed invocation entry, to be called with a host dispatcher. */
  readonly runner: string;
  readonly files: ReadonlyMap<
    string,
    { readonly code: string; readonly sourceMap?: string }
  >;
}
export interface ProjectModule {
  readonly program: Program;
  readonly model: SemanticModel;
  readonly dependencies: ReadonlyMap<ImportDeclaration, string>;
}
export interface ExternalResolution {
  readonly specifier: string;
  readonly exports?: Readonly<Record<string, SemanticType>>;
  readonly value?: SemanticType;
}
export interface ProjectResult {
  /** Captured per-import resolutions and declarations for replay during editor validation. */
  readonly externals?: ReadonlyMap<string, string | ExternalResolution>;
  /** Manifest inputs, kept separate from compilable Clio sources. */
  readonly manifests?: ReadonlyMap<string, SourceFile>;
  readonly modules: ReadonlyMap<string, ProjectModule>;
  readonly diagnostics: readonly Diagnostic[];
  readonly sources: ReadonlyMap<string, SourceFile>;
  readonly output?: ProjectOutput;
}
/** A host supplies source text by root-relative POSIX path. No IO or evaluation in the compiler. */
export interface ProjectHost {
  /** Non-executing TOML parser supplied by the host for installed Kalandra packages. */
  parseKalandraManifest?: ((text: string) => unknown) | undefined;
  readSource(path: string): Promise<string | null>;
  /** Resolve without executing the dependency. Omit to retain bare specifiers. */
  resolveExternal?(
    dependency: ExternalImport,
    importer: string,
  ): Promise<string | ExternalResolution | null>;
}

function normalize(path: string): string | null {
  if (path.startsWith("/") || /[\\:\0]/.test(path)) return null;
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!parts.length) return null;
      parts.pop();
    } else parts.push(part);
  }
  return parts.length ? parts.join("/") : null;
}
// ASCII filenames avoid runtime disagreements over URL escapes in import specifiers.
const outputPath = (path: string) =>
  path
    .split("/")
    .map((part) =>
      /^[a-zA-Z0-9._-]+$/.test(part)
        ? part
        : "~" +
          Array.from(part)
            .map((char) => char.codePointAt(0)!.toString(16))
            .join("-"),
    )
    .join("/") + ".mjs";
const directory = (path: string) => path.split("/").slice(0, -1).join("/");
function relative(from: string, to: string): string {
  const a = directory(from).split("/").filter(Boolean),
    b = to.split("/");
  while (a.length && a[0] === b[0]) {
    a.shift();
    b.shift();
  }
  const path = [...a.map(() => ".."), ...b]
    .map((part) => (part === ".." ? part : encodeURIComponent(part)))
    .join("/");
  return path.startsWith("../") ? path : `./${path}`;
}

type FunctionOrigin = { kind: "function"; path: string; id: number };
type Origin =
  | FunctionOrigin
  | { kind: "remoteType"; recordId: string }
  | { kind: "type"; path: string; id: number }
  | { kind: "namespace"; exports: ReadonlyMap<string, Origin> };
interface AnalyzedModule {
  startupBindings: ReadonlySet<Node>;
  source: SourceFile;
  program: Program;
  model: SemanticModel;
  importPaths: ReadonlyMap<ImportDeclaration, string>;
  origins: ReadonlyMap<number, Origin>;
  exports: ReadonlyMap<string, Origin>;
}

function originOf(node: Node, module: AnalyzedModule): Origin | undefined {
  const symbol = module.model.bindings.get(node);
  if (symbol) {
    let origin = module.origins.get(symbol.id);
    if ("kind" in node && node.kind === "Decorator")
      for (const part of (node as Decorator).name.slice(1))
        origin =
          origin?.kind === "namespace" ? origin.exports.get(part) : undefined;
    return origin;
  }
  if ("kind" in node && node.kind === "Member") {
    const member = node as Member;
    const object = originOf(member.object, module);
    if (object?.kind === "namespace")
      return object.exports.get(member.property);
  }
}

/** Analyze local imports and export signatures without lowering or generating code. */
export function analyzeProject(
  entry: string,
  host: ProjectHost,
  options: AnalysisOptions = {},
) {
  return project(entry, host, options, false);
}

/** Build an acyclic graph of local Kalandra modules, atomically returning all output or none. */
export function compileProject(
  entry: string,
  host: ProjectHost,
  options: ProjectCompileOptions = {},
) {
  return project(entry, host, options, true);
}

async function project(
  entry: string,
  host: ProjectHost,
  options: ProjectCompileOptions,
  emit: boolean,
): Promise<ProjectResult> {
  const projectModules = new Map<string, ProjectModule>();
  const diagnostics: Diagnostic[] = [];
  const sources = new Map<string, SourceFile>();
  const manifests = new Map<string, SourceFile>();
  const remoteContracts = new Map<string, RemoteClientManifest>();
  const externals = new Map<string, string | ExternalResolution>();
  const reads = new Map<string, Promise<string | null>>();
  const signatures = new Map<string, Readonly<Record<string, SemanticType>>>();
  const analyzed = new Map<string, AnalyzedModule>();
  const files = new Map<string, { code: string; sourceMap?: string }>();
  const visiting: string[] = [];
  const completed = new Set<string>();
  const read = (path: string) => {
    if (!reads.has(path)) reads.set(path, host.readSource(path));
    return reads.get(path)!;
  };
  const error = (code: string, message: string, node?: ImportDeclaration) =>
    diagnostics.push({
      code,
      severity: "error",
      message,
      ...(node ? { span: node.span } : {}),
    });
  const root = normalize(entry);
  if (!root || !root.endsWith(".kalandra")) {
    error("KAL4101", "Entry must be a root-relative .kalandra path");
    return {
      diagnostics,
      sources,
      manifests,
      externals,
      modules: projectModules,
    };
  }
  const packageRoots = new Map<string, Promise<string>>();
  function packageRoot(name: string): Promise<string> {
    if (!packageRoots.has(name))
      packageRoots.set(
        name,
        (async () => {
          const base = ".kalandra/modules/" + name;
          const path = base + "/kalandra.toml";
          const text = await read(path);
          if (text === null)
            throw new Error(
              "Missing installed Kalandra package manifest " + path,
            );
          manifests.set(path, { path, text });
          if (!host.parseKalandraManifest)
            throw new Error(
              "The project host must provide parseKalandraManifest to read " +
                path,
            );
          const config = host.parseKalandraManifest(text) as {
            build?: { source?: unknown };
          } | null;
          const source = config?.build?.source;
          if (typeof source !== "string" || !source || source.startsWith("/"))
            throw new Error(
              path + " must declare a relative [build].source directory",
            );
          const root = normalize(base + "/" + source);
          if (!root || (root !== base && !root.startsWith(base + "/")))
            throw new Error(
              path + " build.source escapes the package directory",
            );
          return root;
        })(),
      );
    return packageRoots.get(name)!;
  }
  async function candidatesFor(
    specifier: string,
    importer: string,
  ): Promise<string[]> {
    if (specifier.endsWith(".clio"))
      throw new Error(
        "Source imports must use .kalandra or omit the extension",
      );
    let requested: string | null;
    let packageEntry = false;
    if (/^\.{1,2}\//.test(specifier)) {
      requested = normalize(
        [directory(importer), specifier].filter(Boolean).join("/"),
      );
    } else if (specifier.startsWith("/")) {
      const owner = /^\.kalandra\/modules\/([^/]+)\//.exec(importer)?.[1];
      const sourceRoot = owner ? await packageRoot(owner) : "";
      requested = normalize(
        [sourceRoot, specifier.slice(1)].filter(Boolean).join("/"),
      );
      if (
        sourceRoot &&
        requested &&
        requested !== sourceRoot &&
        !requested.startsWith(sourceRoot + "/")
      )
        throw new Error("Import escapes the package source root: " + specifier);
    } else {
      const [name, ...parts] = specifier.split("/");
      if (
        !name ||
        name === "." ||
        name === ".." ||
        /[:\\\0]/.test(specifier) ||
        parts.some((part) => !part)
      )
        throw new Error("Invalid Kalandra package path: " + specifier);
      const sourceRoot = await packageRoot(name);
      requested = normalize([sourceRoot, ...parts].join("/"));
      if (
        !requested ||
        (requested !== sourceRoot && !requested.startsWith(sourceRoot + "/"))
      )
        throw new Error("Import escapes the package source root: " + specifier);
      packageEntry = parts.length === 0;
    }
    if (!requested)
      throw new Error(
        "Import escapes the project root or has an invalid path: " + specifier,
      );
    // Files precede directory entry points. Kalandra has one source extension.
    return packageEntry
      ? [requested + "/main.kalandra"]
      : [
          requested.endsWith(".kalandra") ? requested : requested + ".kalandra",
          requested + "/main.kalandra",
        ];
  }
  async function visit(
    path: string,
    importer?: ImportDeclaration,
  ): Promise<void> {
    if (visiting.includes(path)) {
      error(
        "KAL4102",
        `Cyclic imports are not supported yet: ${[...visiting, path].join(" → ")}`,
        importer,
      );
      return;
    }
    if (completed.has(path)) return;
    completed.add(path);
    let text: string | null;
    try {
      text = await read(path);
    } catch (cause) {
      error("KAL4101", `Cannot read ${path}: ${String(cause)}`, importer);
      return;
    }
    if (text === null) {
      error("KAL4101", `Cannot find source ${path}`, importer);
      return;
    }
    const source = { path, text };
    sources.set(path, source);
    const parsed = parse(source);
    diagnostics.push(...parsed.diagnostics);
    if (
      !parsed.program ||
      parsed.diagnostics.some((d) => d.severity === "error")
    )
      return;
    visiting.push(path);
    const imports = parsed.program.body.filter(
      (node): node is ImportDeclaration => node.kind === "ImportDeclaration",
    );
    const modules: Record<
      string,
      Readonly<Record<string, SemanticType>>
    > = Object.assign(Object.create(null), options.modules);
    const moduleValues = Object.assign(
      Object.create(null),
      options.moduleValues,
    );
    const importPaths = new Map<ImportDeclaration, string>();
    const dependencies = new Map<ImportDeclaration, string>();
    const remoteOrigins = new Map<
      ImportDeclaration,
      ReadonlyMap<string, Origin>
    >();
    for (const node of imports) {
      if (node.path.startsWith("remote:")) {
        try {
          const requested = node.path.slice(7);
          if (!/^\.{1,2}\//.test(requested) || !requested.endsWith(".json"))
            throw new Error(
              "Remote imports require a relative .json client contract",
            );
          const contractPath = normalize(
            [directory(path), requested].filter(Boolean).join("/"),
          );
          if (!contractPath)
            throw new Error("Remote contract escapes the project root");
          const text = await read(contractPath);
          if (text === null)
            throw new Error(
              `Cannot find remote client contract ${contractPath}`,
            );
          manifests.set(contractPath, { path: contractPath, text });
          const contract = parseRemoteClientManifest(text);
          remoteContracts.set(contractPath, contract);
          remoteOrigins.set(
            node,
            new Map(
              Object.entries(contract.types ?? {}).map(([name, id]) => [
                name,
                {
                  kind: "remoteType",
                  recordId: remoteRecordScope(contract.revision) + id,
                } as const,
              ]),
            ),
          );
          modules[node.path] = remoteSignatures(contractPath, contract);
          const stubPath = ".kalandra/remotes/" + outputPath(contractPath);
          importPaths.set(node, relative(outputPath(path), stubPath));
          files.set(stubPath, {
            code: [
              `import helpers from ${JSON.stringify(relative(stubPath, ".kalandra/runtime.mjs"))};`,
              `import ${JSON.stringify(relative(stubPath, ".kalandra/records.mjs"))};`,
              ...Object.entries(contract.types ?? {}).map(
                ([name, id], index) =>
                  `const t${index} = helpers.getRecord(${JSON.stringify(remoteRecordScope(contract.revision) + id)}); export {t${index} as ${JSON.stringify(name)}};`,
              ),
              ...Object.keys(contract.services).map(
                (id, index) =>
                  `const r${index} = () => { throw new Error("Remote handles require a checked managed call"); }; export { r${index} as ${JSON.stringify(id)} };`,
              ),
            ].join("\n"),
          });
        } catch (cause) {
          error(
            "KAL4302",
            `Cannot resolve ${node.path}: ${String(cause)}`,
            node,
          );
        }
        continue;
      }
      const external = externalImport(node.path);
      if (external) {
        try {
          const resolution = host.resolveExternal
            ? await host.resolveExternal(external, path)
            : external.specifier;
          if (!resolution)
            error(
              "KAL4104",
              `Cannot resolve external module ${node.path}`,
              node,
            );
          else {
            externals.set(JSON.stringify([path, node.path]), resolution);
            const specifier =
              typeof resolution === "string"
                ? resolution
                : resolution.specifier;
            importPaths.set(node, specifier);
            if (typeof resolution !== "string") {
              if (resolution.exports && !Object.hasOwn(modules, node.path))
                modules[node.path] = resolution.exports;
              if (resolution.value && !Object.hasOwn(moduleValues, node.path))
                moduleValues[node.path] = resolution.value;
            }
          }
        } catch (cause) {
          error(
            "KAL4104",
            `Cannot resolve external module ${node.path}: ${String(cause)}`,
            node,
          );
        }
        continue;
      }
      if (/[:\\\0]/.test(node.path)) {
        error(
          "KAL4103",
          "Unsupported Clio import path or transport: " + node.path,
          node,
        );
        continue;
      }
      let candidates: string[];
      try {
        candidates = await candidatesFor(node.path, path);
      } catch (cause) {
        error(
          "KAL4101",
          "Cannot resolve " + node.path + ": " + String(cause),
          node,
        );
        continue;
      }
      let dependency: string | undefined;
      try {
        for (const candidate of candidates)
          if ((await read(candidate)) !== null) {
            dependency = candidate;
            break;
          }
      } catch (cause) {
        error(
          "KAL4101",
          `Cannot read import ${node.path}: ${String(cause)}`,
          node,
        );
        continue;
      }
      if (!dependency) {
        error(
          "KAL4101",
          `Cannot find ${node.path}; tried ${candidates.join(", ")}`,
          node,
        );
        continue;
      }
      await visit(dependency, node);
      dependencies.set(node, dependency);
      const exported = signatures.get(dependency);
      if (exported) modules[node.path] = exported;
      importPaths.set(node, relative(outputPath(path), outputPath(dependency)));
    }
    visiting.pop();
    let analysis = analyzeProgram(parsed.program, {
      ...options,
      modules,
      moduleValues,
    });
    const sourceAnalysis = analysis;
    const startup =
      analysis.model &&
      !analysis.diagnostics.some((d) => d.severity === "error")
        ? startupTargets(parsed.program, analysis.model)
        : { program: parsed.program, links: [] };
    const program = startup.program;
    if (program !== parsed.program)
      analysis = analyzeProgram(program, { ...options, modules, moduleValues });
    diagnostics.push(...analysis.diagnostics);
    if (sourceAnalysis.model)
      projectModules.set(path, {
        program: parsed.program,
        model: sourceAnalysis.model,
        dependencies,
      });
    if (
      !analysis.model ||
      analysis.diagnostics.some((d) => d.severity === "error")
    )
      return;
    signatures.set(
      path,
      Object.fromEntries(
        [...analysis.model.exports].map(([name, symbol]) => [
          name,
          symbol.type,
        ]),
      ),
    );
    const origins = new Map<number, Origin>();
    for (const statement of program.body) {
      const declaration =
        statement.kind === "ExportDeclaration"
          ? statement.declaration
          : statement;
      const fn =
        declaration.kind === "DecoratedFunction"
          ? declaration.declaration
          : declaration;
      if (
        fn.kind === "FunctionDeclaration" ||
        fn.kind === "TypeDeclaration" ||
        fn.kind === "ListDeclaration"
      ) {
        const id = analysis.model.bindings.get(fn)!.id;
        origins.set(id, {
          kind: fn.kind === "FunctionDeclaration" ? "function" : "type",
          path,
          id,
        });
      }
    }
    for (const link of startup.links)
      origins.set(analysis.model.bindings.get(link.binding.target)!.id, {
        kind: "function",
        path,
        id: analysis.model.bindings.get(link.target)!.id,
      });
    for (const node of imports) {
      const dependency = dependencies.get(node);
      const exported =
        remoteOrigins.get(node) ??
        (dependency ? analyzed.get(dependency)?.exports : undefined);
      if (!exported) continue;
      if (!node.items.length) {
        origins.set(analysis.model.bindings.get(node)!.id, {
          kind: "namespace",
          exports: exported,
        });
      } else
        for (const item of node.items) {
          const origin: Origin | undefined =
            item.name === "*"
              ? // Mixed rest imports are mutable object copies, not ESM namespace
                // bindings. Their members cannot be treated as fixed task identities.
                node.items.some((selected) => selected.name !== "*")
                ? undefined
                : { kind: "namespace", exports: exported }
              : exported.get(item.name);
          if (origin)
            origins.set(analysis.model.bindings.get(item)!.id, origin);
        }
    }
    const exports = new Map<string, Origin>();
    for (const [name, symbol] of analysis.model.exports) {
      const origin = origins.get(symbol.id);
      if (origin) exports.set(name, origin);
    }
    analyzed.set(path, {
      startupBindings: new Set(startup.links.map((link) => link.binding)),
      source,
      program,
      model: analysis.model,
      importPaths,
      origins,
      exports,
    });
  }
  await visit(root);
  let remoteRecordCode = "";
  try {
    remoteRecordCode = emitRemoteRecords(remoteContracts.values());
  } catch (cause) {
    error(
      "KAL4302",
      `Cannot establish remote record identities: ${String(cause)}`,
    );
  }

  const remoteAliases = new Map<string, ReadonlySet<Node>>();
  const remoteCalls = new Map<
    string,
    ReturnType<typeof remoteTargets>["targets"]
  >();
  for (const [path, module] of analyzed) {
    const selected = remoteTargets(module.program, module.model);
    remoteCalls.set(path, selected.targets);
    remoteAliases.set(path, selected.aliases);
    diagnostics.push(...selected.diagnostics);
    diagnostics.push(
      ...validateParallelTypes(
        module.program,
        module.model,
        selected.targets,
        (node, owner) => {
          const context = [...analyzed.values()].find(
            (value) => value.model === owner,
          )!;
          const origin = originOf(node, context);
          if (origin?.kind !== "function") return;
          const target = analyzed.get(origin.path)!;
          for (const statement of target.program.body) {
            const declaration =
              statement.kind === "ExportDeclaration"
                ? statement.declaration
                : statement;
            const fn =
              declaration.kind === "DecoratedFunction"
                ? declaration.declaration
                : declaration;
            if (
              fn.kind === "FunctionDeclaration" &&
              target.model.bindings.get(fn)?.id === origin.id
            )
              return {
                declaration: declaration as
                  | import("./syntax/ast.js").FunctionDeclaration
                  | import("./syntax/ast.js").DecoratedFunction,
                model: target.model,
              };
          }
        },
        (callee, schema) =>
          selected.targets.set(callee, {
            ...selected.targets.get(callee)!,
            schema,
          }),
        () => [],
        [],
        selected.localValues,
      ),
    );
  }
  if (!emit)
    return {
      diagnostics,
      sources,
      manifests,
      externals,
      modules: projectModules,
    };
  if (diagnostics.some((d) => d.severity === "error"))
    return {
      diagnostics,
      sources,
      manifests,
      externals,
      modules: projectModules,
    };

  // Resolve all task requests before emitting dependencies: importers can select
  // functions in modules that have no parallel calls of their own.
  function createPlans() {
    const plans = new Map<string, ReturnType<typeof createParallelPlan>>();
    for (const [path, module] of analyzed) {
      plans.set(
        path,
        createParallelPlan(
          module.program,
          module.model,
          relative(outputPath(path), outputPath(path) + ".tasks.mjs"),
          (node) => {
            const origin = originOf(node, module);
            if (!origin || origin.kind === "namespace") return;
            if (origin.kind === "remoteType")
              return {
                target: {
                  module: "",
                  exportName: "",
                  declarationKind: "type",
                  recordId: origin.recordId,
                },
                include() {},
              };
            return {
              target: {
                module: relative(
                  outputPath(path),
                  outputPath(origin.path) + ".tasks.mjs",
                ),
                exportName: `task${origin.id}`,
                ...(origin.kind === "type"
                  ? { declarationKind: "type" as const }
                  : {}),
              },
              include() {
                if (origin.kind === "type")
                  plans.get(origin.path)!.includeType(origin.id);
                else plans.get(origin.path)!.include(origin.id);
              },
            };
          },
        ),
      );
    }
    return plans;
  }
  const plans = createPlans();
  for (const plan of plans.values()) plan.selectTargets();
  const services = new Map<
    string,
    {
      origin: FunctionOrigin;
      publicName: string;
      signature?: TaskSchema;
      publicSchemas?: string[];
      internal?: TaskSchema;
    }
  >();
  if (options.remoteServices !== undefined) {
    const entries = Object.entries(options.remoteServices).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    if (!entries.length || entries.length > 256)
      error("KAL4301", "Remote builds must select 1–256 services");
    const selected = new Set<string>();
    for (const [id, publicName] of entries) {
      const origin = analyzed.get(root)!.exports.get(publicName);
      if (
        !remoteIdentifier.test(id) ||
        typeof publicName !== "string" ||
        origin?.kind !== "function"
      ) {
        error(
          "KAL4301",
          `Remote service ${id} must select an exported module-level Kalandra function (${String(publicName)})`,
        );
        continue;
      }
      const key = JSON.stringify([origin.path, origin.id]);
      if (selected.has(key)) {
        error(
          "KAL4301",
          `Remote function ${publicName} has multiple service IDs; each task must have one route`,
        );
        continue;
      }
      selected.add(key);
      services.set(id, { origin, publicName });
      plans.get(origin.path)!.include(origin.id);
    }
  }
  // Each capture closure contains exactly the reachable code and data of one target.
  const closures = new Map<string, ReturnType<typeof captureClosure>>();
  function captureClosure(path: string, id: number) {
    const graph = createPlans();
    graph.get(path)!.include(id);
    const captures = [...graph].flatMap(([owner, plan]) =>
      [...plan.captures.values()].map(({ symbol, node }) => ({
        key: JSON.stringify([owner, symbol.id]),
        path: owner,
        symbol,
        node,
        name: symbol.name,
        model: analyzed.get(owner)!.model,
      })),
    );
    return {
      graph,
      captures,
      nested: [...graph.values()].some((plan) => plan.nested.size > 0),
    };
  }
  for (const [path, plan] of plans)
    for (const id of plan.selected)
      closures.set(JSON.stringify([path, id]), captureClosure(path, id));
  const closureOf = (origin: FunctionOrigin) =>
    closures.get(JSON.stringify([origin.path, origin.id]))!;
  const callClosure = (callee: Node, module: AnalyzedModule) => {
    const origin = originOf(
      (callee as Member).kind === "Member" ? (callee as Member).object : callee,
      module,
    );
    return origin?.kind === "function" ? closureOf(origin) : undefined;
  };
  const taskSchemas = new Map<string, Record<string, string[]>>();
  for (const [path, module] of analyzed) {
    diagnostics.push(
      ...validateParallelTypes(
        module.program,
        module.model,
        plans.get(path)!.targets,
        (node, owner) => {
          const context = [...analyzed.values()].find(
            (value) => value.model === owner,
          )!;
          const origin = originOf(node, context);
          if (origin?.kind !== "function") return;
          const declaration = plans
            .get(origin.path)!
            .declarations.get(origin.id);
          return declaration
            ? { declaration, model: analyzed.get(origin.path)!.model }
            : undefined;
        },
        (callee, schema) => {
          const target = plans.get(path)!.targets.get(callee)!;
          plans.get(path)!.targets.set(callee, {
            ...target,
            schema,
            captures: callClosure(callee, module)!.captures.map(
              (capture) => capture.key,
            ),
          });
          const origin = originOf(
            callee.kind === "Member" ? callee.object : callee,
            module,
          )!;
          if (origin.kind !== "function")
            throw new Error("Missing task origin");
          const manifest = taskSchemas.get(origin.path) ?? {};
          const name = `task${origin.id}`;
          manifest[name] ??= [];
          const key = schemaKey(schema);
          if (!manifest[name]!.includes(key)) manifest[name]!.push(key);
          taskSchemas.set(origin.path, manifest);
        },
        (callee) => callClosure(callee, module)?.captures ?? [],
        [...services.values()]
          .filter((service) => service.origin.path === path)
          .map((service) => ({
            definition: {
              declaration: plans
                .get(path)!
                .declarations.get(service.origin.id)!,
              model: module.model,
            },
            captures: closureOf(service.origin).captures,
            onSchema(schema: TaskSchema) {
              const count = closureOf(service.origin).captures.length;
              service.internal = schema;
              service.signature = {
                args: schema.args.slice(count),
                result: schema.result,
              };
              const manifest = taskSchemas.get(path) ?? {};
              const name = `task${service.origin.id}`;
              manifest[name] ??= [];
              const publicSchemas = [
                service.signature,
                ...remoteMapSchemas(service.signature),
              ];
              service.publicSchemas = [];
              for (const publicSchema of publicSchemas) {
                let key: string;
                try {
                  key = schemaKey({
                    args: [
                      ...schema.args.slice(0, count),
                      ...publicSchema.args,
                    ],
                    result: publicSchema.result,
                  });
                } catch {
                  continue; // Optional map metadata may exceed the private schema budget.
                }
                service.publicSchemas.push(schemaKey(publicSchema));
                if (!manifest[name]!.includes(key)) manifest[name]!.push(key);
              }
              taskSchemas.set(path, manifest);
            },
          })),
      ),
    );
  }
  const serviceCaptures = [
    ...new Map(
      [...services.values()].flatMap((service) =>
        closureOf(service.origin).captures.map(
          (capture) => [capture.key, capture] as const,
        ),
      ),
    ).values(),
  ];
  let bootstrap: ReturnType<typeof remoteCaptureBootstrap> | undefined;
  if (serviceCaptures.length) {
    try {
      bootstrap = remoteCaptureBootstrap(analyzed, serviceCaptures);
      files.set(".kalandra/bootstrap.mjs", { code: bootstrap.code });
    } catch (cause) {
      error("KAL4301", `Cannot bind remote captures: ${String(cause)}`);
    }
  }
  for (const plan of plans.values()) diagnostics.push(...plan.diagnostics);
  if (diagnostics.some((d) => d.severity === "error"))
    return {
      diagnostics,
      sources,
      manifests,
      externals,
      modules: projectModules,
    };
  for (const [path, module] of analyzed) {
    const { source, program, model, importPaths } = module;
    const parallel = plans.get(path)!;
    const taskPath = outputPath(path) + ".tasks.mjs";
    const scoped = new Set(
      [...parallel.selected].filter((id) => {
        const closure = closureOf({ kind: "function", path, id });
        return closure.captures.length || closure.nested;
      }),
    );
    const scopeExports: string[] = [];
    for (const id of scoped) {
      const { graph, captures } = closureOf({ kind: "function", path, id });
      let nextId = 0;
      const ids = new Map<string, Map<number, number>>();
      for (const [owner, context] of analyzed) {
        const symbols = new Map<number, number>();
        for (const scope of context.model.scopes)
          for (const symbol of scope.symbols.values())
            if (!symbols.has(symbol.id)) symbols.set(symbol.id, nextId++);
        ids.set(owner, symbols);
      }
      const binding = (owner: string, symbolId: number): IRBinding => {
        const symbol = [...analyzed.get(owner)!.model.scopes]
          .flatMap((scope) => [...scope.symbols.values()])
          .find((symbol) => symbol.id === symbolId)!;
        return {
          id: ids.get(owner)!.get(symbolId)!,
          name: symbol.name,
          type: symbol.type,
        };
      };
      const bodies: IRStatement[] = [];
      const reservedNames = new Set<string>();
      for (const [owner, plan] of graph) {
        if (!plan.selected.size && !plan.selectedTypes.size) continue;
        const context = analyzed.get(owner)!;
        const references = new Map<Node, TaskReference>();
        for (const node of plan.dependencies.keys()) {
          const origin = originOf(node, context)!;
          if (origin.kind === "remoteType")
            references.set(node, { recordId: origin.recordId });
          else if (origin.kind !== "namespace")
            references.set(node, binding(origin.path, origin.id));
        }
        const nestedTargets = new Map(
          [...plans.get(owner)!.targets].map(([node, target]) => {
            const origin = originOf(
              (node as Member).kind === "Member"
                ? (node as Member).object
                : node,
              context,
            );
            return [
              node,
              origin?.kind === "function"
                ? {
                    ...target,
                    module: relative(
                      outputPath(path),
                      outputPath(origin.path) + ".tasks.mjs",
                    ),
                  }
                : target,
            ] as const;
          }),
        );
        const lowered = lower(
          plan.taskProgram,
          context.model,
          new Map(),
          new Map([...nestedTargets, ...remoteCalls.get(owner)!]),
          references,
          ids.get(owner)!,
          remoteAliases.get(owner)!,
        );
        diagnostics.push(...lowered.diagnostics);
        if (!lowered.module) continue;
        bodies.push(...lowered.module.body);
        for (const name of lowered.module.reservedNames)
          reservedNames.add(name);
      }
      const taskModule: IRModule = {
        kind: "Module",
        span: program.span,
        body: bodies,
        reservedNames: [...reservedNames],
      };
      const scopePath = outputPath(path) + `.task${id}.scope.mjs`;
      const emitted = emitJavaScript(
        taskModule,
        source,
        relative(scopePath, ".kalandra/runtime.mjs"),
        relative(scopePath, ".kalandra/parallel.mjs"),
        {
          task: {
            name: `task${id}`,
            root: binding(path, id),
            captureKeys: captures.map((capture) => capture.key),
            captures: captures.map((capture) =>
              binding(capture.path, capture.symbol.id),
            ),
          },
          sources: [...analyzed.values()].map((context) => context.source),
        },
      );
      diagnostics.push(...emitted.diagnostics);
      if (emitted.output) files.set(scopePath, emitted.output);
      scopeExports.push(
        `export { task${id} } from ${JSON.stringify(relative(taskPath, scopePath))};`,
      );
    }
    if (parallel.selected.size || parallel.selectedTypes.size) {
      const references = new Map<Node, TaskReference>();
      const importedBindings = new Map<string, IRBinding>();
      const taskImports: IRStatement[] = [];
      for (const [node, target] of parallel.dependencies) {
        if (target.recordId) {
          references.set(node, { recordId: target.recordId });
          continue;
        }
        const key = JSON.stringify([target.module, target.exportName]);
        let binding = importedBindings.get(key);
        if (!binding) {
          // Semantic symbol IDs are nonnegative; generated imports use a separate range.
          binding = {
            id: -1 - importedBindings.size,
            name: target.exportName,
            type: model.types.get(node) ?? anyType,
          };
          importedBindings.set(key, binding);
          taskImports.push({
            kind: "Import",
            mode: "esm",
            span: node.span,
            type: anyType,
            path: target.module,
            bindings: [{ imported: target.exportName, binding }],
          });
        }
        references.set(node, binding);
      }
      const tasks = lower(
        {
          ...parallel.taskProgram,
          body: parallel.taskProgram.body.filter((declaration) => {
            const fn =
              declaration.kind === "DecoratedFunction"
                ? declaration.declaration
                : declaration;
            return (
              fn.kind !== "FunctionDeclaration" ||
              !scoped.has(model.bindings.get(fn)!.id)
            );
          }),
        },
        model,
        new Map(),
        new Map(),
        references,
      );
      diagnostics.push(...tasks.diagnostics);
      if (!tasks.module) continue;
      const exports: IRStatement[] = [
        ...[...parallel.selected].filter((id) => !scoped.has(id)),
        ...parallel.selectedTypes,
      ].map((id) => {
        const declaration = (parallel.declarations.get(id) ??
          parallel.types.get(id))!;
        const fn =
          declaration.kind === "DecoratedFunction"
            ? declaration.declaration
            : declaration;
        const symbol = model.bindings.get(fn)!;
        return {
          kind: "Export",
          span: fn.span,
          type: anyType,
          name: `task${id}`,
          value: {
            kind: "Reference",
            span: fn.span,
            type: symbol.type,
            name: symbol.name,
            binding: { id, name: symbol.name, type: symbol.type },
          },
        };
      });
      const emittedTasks = emitJavaScript(
        {
          ...tasks.module,
          body: [...taskImports, ...tasks.module.body, ...exports],
        },
        source,
        relative(taskPath, ".kalandra/runtime.mjs"),
      );
      diagnostics.push(...emittedTasks.diagnostics);
      if (emittedTasks.output)
        files.set(taskPath, {
          ...emittedTasks.output,
          code:
            emittedTasks.output.code +
            "\n" +
            scopeExports.join("\n") +
            `\nimport ${JSON.stringify(relative(taskPath, ".kalandra/records.mjs"))};\nexport { default as __kalandraRecords } from ${JSON.stringify(relative(taskPath, ".kalandra/runtime.mjs"))};\nexport const __kalandraContextTasks = ${JSON.stringify([...scoped].map((id) => `task${id}`))};\nexport const __kalandraSchemas = ${JSON.stringify(taskSchemas.get(path) ?? {})};\n`,
        });
    }
    const lowered = lower(
      program,
      model,
      importPaths,
      new Map([...parallel.targets, ...remoteCalls.get(path)!]),
      new Map(),
      new Map(),
      remoteAliases.get(path)!,
    );
    diagnostics.push(...lowered.diagnostics);
    if (!lowered.module) continue;
    const emitted = emitJavaScript(
      lowered.module,
      source,
      relative(outputPath(path), ".kalandra/runtime.mjs"),
      relative(outputPath(path), ".kalandra/parallel.mjs"),
      {
        captureReaders: [...parallel.captures.values()].map(({ symbol }) => ({
          key: JSON.stringify([path, symbol.id]),
          binding: { id: symbol.id, name: symbol.name, type: symbol.type },
        })),
      },
    );
    diagnostics.push(...emitted.diagnostics);
    if (emitted.output) files.set(outputPath(path), emitted.output);
  }
  if (diagnostics.some((d) => d.severity === "error"))
    return {
      diagnostics,
      sources,
      manifests,
      externals,
      modules: projectModules,
    };
  // One shared instance keeps Range and Any identity consistent throughout the graph.
  files.set(".kalandra/runtime.mjs", {
    code: `export default ${helperSource};`,
  });
  files.set(".kalandra/records.mjs", {
    code:
      emitTaskRecords(
        analyzed.values(),
        new Set(
          [...remoteContracts.values()].flatMap((contract) =>
            Object.keys(contract.records ?? {}).map(
              (id) => remoteRecordScope(contract.revision) + id,
            ),
          ),
        ),
      ) + (remoteContracts.size ? '\nimport "./remote-records.mjs";\n' : ""),
  });
  if (remoteContracts.size)
    files.set(".kalandra/remote-records.mjs", { code: remoteRecordCode });
  files.set(".kalandra/parallel.mjs", { code: parallelBridgeSource });
  const runner = ".kalandra/program.mjs";
  files.set(runner, {
    code: `
import { withDispatch } from "./parallel.mjs";
export function run(dispatch, exportName = "main", args = []) {
  return withDispatch(dispatch, async () => {
    const module = await import(${JSON.stringify(relative(runner, outputPath(root)))});
    if (!Object.hasOwn(module, exportName) || typeof module[exportName] !== "function")
      throw new Error("Program entry must export a callable " + exportName);
    return await module[exportName](...args);
  });
}`,
  });
  let remoteImports: string | undefined;
  if (remoteContracts.size) {
    try {
      const manifest = parseRemoteImportManifest(
        JSON.stringify({
          version: 1,
          contracts: Object.fromEntries(
            [...remoteContracts].sort(([a], [b]) =>
              a < b ? -1 : a > b ? 1 : 0,
            ),
          ),
        }),
      );
      remoteImports = "kalandra.remotes.json";
      files.set(remoteImports, { code: JSON.stringify(manifest) });
    } catch (cause) {
      error(
        "KAL4302",
        `Cannot generate remote import manifest: ${String(cause)}`,
      );
      return {
        diagnostics,
        sources,
        manifests,
        externals,
        modules: projectModules,
      };
    }
  }
  let remote: ProjectOutput["remote"];
  if (options.remoteServices !== undefined) {
    try {
      const registrations: Record<string, RemoteClientService> =
        Object.create(null);
      for (const [id, service] of services) {
        const { origin, publicName, signature } = service;
        const type = analyzed.get(root)!.model.exports.get(publicName)!.type;
        if (!signature || type.kind !== "Callable")
          throw new Error("Missing checked service signature");
        registrations[id] = {
          module: outputPath(origin.path) + ".tasks.mjs",
          exportName: `task${origin.id}`,
          schemas: closureOf(origin).captures.length
            ? service.publicSchemas!
            : [...taskSchemas.get(origin.path)![`task${origin.id}`]!].sort(),
          source: { module: root, exportName: publicName },
          signature,
          async: type.async,
        };
      }
      const generated = await remoteManifests(
        files,
        registrations,
        serviceRecordMetadata(
          analyzed.values(),
          analyzed.get(root)!.model,
          registrations,
        ),
        bootstrap
          ? {
              bootstrap: {
                module: ".kalandra/bootstrap.mjs",
                schema: bootstrap.schema,
              },
              bindings: Object.fromEntries(
                [...services]
                  .filter(
                    ([, service]) => closureOf(service.origin).captures.length,
                  )
                  .map(([id, service]) => [
                    id,
                    {
                      schema: service.internal!,
                      indices: closureOf(service.origin).captures.map(
                        (capture) =>
                          serviceCaptures.findIndex(
                            (value) => value.key === capture.key,
                          ),
                      ),
                    },
                  ]),
              ),
            }
          : undefined,
      );
      remote = {
        deployment: "kalandra.deployment.json",
        client: "kalandra.client.json",
        revision: generated.client.revision,
      };
      files.set(remote.deployment, {
        code: JSON.stringify({
          ...generated.deployment,
          ...(remoteImports ? { remoteImports } : {}),
        }),
      });
      files.set(remote.client, { code: JSON.stringify(generated.client) });
    } catch (cause) {
      error("KAL4301", `Cannot generate remote manifests: ${String(cause)}`);
      return {
        diagnostics,
        sources,
        manifests,
        externals,
        modules: projectModules,
      };
    }
  }
  return {
    diagnostics,
    sources,
    manifests,
    externals,
    modules: projectModules,
    output: {
      entry: outputPath(root),
      runner,
      files,
      ...(remote ? { remote } : {}),
      ...(remoteImports ? { remoteImports } : {}),
    },
  };
}
