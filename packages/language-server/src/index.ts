import {
  analyze,
  type Diagnostic,
  type AnalysisOptions,
} from "@kalandra/compiler";
import { TextDocument } from "vscode-languageserver-textdocument";
import type {
  Diagnostic as EditorDiagnostic,
  TextDocumentContentChangeEvent,
} from "vscode-languageserver";

export type { Diagnostic, SourceFile, SourceSpan } from "@kalandra/compiler";

/** Single-file editor analysis: only supplied buffer text is read, never disk. */
export function documentDiagnostics(
  document: TextDocument,
  options: AnalysisOptions = {},
): EditorDiagnostic[] {
  return editorDiagnostics(
    document,
    analyze({ path: document.uri, text: document.getText() }, options)
      .diagnostics,
  );
}

export function editorDiagnostics(
  document: TextDocument,
  diagnostics: readonly Diagnostic[],
): EditorDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    range: {
      start: document.positionAt(diagnostic.span?.start ?? 0),
      end: document.positionAt(
        diagnostic.span?.end ?? diagnostic.span?.start ?? 0,
      ),
    },
    severity:
      diagnostic.severity === "error"
        ? 1
        : diagnostic.severity === "warning"
          ? 2
          : 3,
    code: diagnostic.code,
    source: "kalandra",
    message: diagnostic.message,
  }));
}

/** Versioned buffers are isolated by URI; stale edits cannot restore old errors. */
export class DocumentStore {
  private readonly documents = new Map<string, TextDocument>();
  constructor(private readonly options: AnalysisOptions = {}) {}
  open(uri: string, languageId: string, version: number, text: string) {
    const previous = this.documents.get(uri);
    if (previous && version <= previous.version) return;
    const document = TextDocument.create(uri, languageId, version, text);
    this.documents.set(uri, document);
    return this.report(document);
  }
  change(
    uri: string,
    version: number,
    changes: TextDocumentContentChangeEvent[],
  ) {
    const document = this.documents.get(uri);
    if (!document || version <= document.version) return;
    TextDocument.update(document, changes, version);
    return this.report(document);
  }
  close(uri: string) {
    if (!this.documents.delete(uri)) return;
    return { uri, diagnostics: [] as EditorDiagnostic[] };
  }
  private report(document: TextDocument) {
    return {
      uri: document.uri,
      version: document.version,
      diagnostics: documentDiagnostics(document, this.options),
    };
  }
}

export { WorkspaceDocuments, type WorkspaceHost } from "./workspace.js";
