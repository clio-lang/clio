import type { CompilationResult, SourceFile } from "./index.js";
import { analyze } from "./semantic/analyze.js";
import type { AnalysisOptions } from "./semantic/types.js";
import { lower } from "./lowering/lower.js";
import { emitJavaScript } from "./emitter/javascript.js";

/** Compile without IO or execution. Any error prevents JavaScript output. */
export function compile(
  source: SourceFile,
  options: AnalysisOptions = {},
): CompilationResult {
  const analysis = analyze(source, options);
  if (
    !analysis.program ||
    !analysis.model ||
    analysis.diagnostics.some((item) => item.severity === "error")
  )
    return { diagnostics: analysis.diagnostics };
  const lowered = lower(analysis.program, analysis.model);
  const diagnostics = [...analysis.diagnostics, ...lowered.diagnostics];
  if (!lowered.module) return { diagnostics };
  const emitted = emitJavaScript(lowered.module, source);
  return { ...emitted, diagnostics: [...diagnostics, ...emitted.diagnostics] };
}
