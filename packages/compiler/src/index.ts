/** Portable compiler contracts. Includes parsing, single-file analysis, and ESM emission for the supported subset. */
export interface SourceFile {
  readonly path: string;
  readonly text: string;
}

/** Half-open UTF-16 offsets into a source file. */
export interface SourceSpan {
  readonly file: string;
  readonly start: number;
  readonly end: number;
}

export interface Diagnostic {
  readonly code: string;
  readonly severity: "error" | "warning" | "info";
  readonly message: string;
  readonly span?: SourceSpan;
}

export interface CompilationResult {
  readonly diagnostics: readonly Diagnostic[];
  readonly output?: { readonly code: string; readonly sourceMap: string };
}

export { formatSource, type FormatResult } from "./format.js";
export { parse, type ParseResult } from "./syntax/parse.js";
export {
  tokenize,
  type TokenizeResult,
  type SourceComment,
} from "./syntax/lexer.js";
export type * from "./syntax/ast.js";

export { analyze, analyzeProgram } from "./semantic/analyze.js";
export { anyType, typeName } from "./semantic/types.js";
export type * from "./semantic/types.js";

export { compile } from "./compile.js";
export { lower, type LoweringResult } from "./lowering/lower.js";
export type * from "./lowering/ir.js";

export {
  compileProject,
  analyzeProject,
  type ProjectHost,
  type ExternalResolution,
  type ProjectResult,
  type ProjectModule,
  type ProjectOutput,
  type ProjectCompileOptions,
} from "./project.js";

export type { ExternalImport } from "./modules.js";

export type {
  RemoteImportManifest,
  RemoteClientManifest,
  RemoteClientService,
  RemoteDeploymentManifest,
  RemoteServiceManifest,
} from "../../protocol/src/remote-contract.js";

export type {
  RemoteRecordDeclaration,
  RemoteRecordMetadata,
} from "../../protocol/src/remote-records.js";

export {
  sourceDocumentation,
  type FunctionDocumentation,
} from "./documentation.js";
