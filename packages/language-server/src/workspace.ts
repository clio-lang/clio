import {
  analyze,
  analyzeProject,
  formatSource,
  type ProjectResult,
  type ProjectHost,
  type AnalysisOptions,
  type SourceFile,
  type SourceSpan,
  type ProjectModule,
  type ExternalResolution,
} from "@kalandra/compiler";
import { TextDocument } from "vscode-languageserver-textdocument";
import type {
  PublishDiagnosticsParams,
  Position,
  Location,
  Hover,
  CompletionItem,
  WorkspaceEdit,
  TextDocumentEdit,
  TextEdit,
  TextDocumentContentChangeEvent,
} from "vscode-languageserver";
import { ProjectIndex } from "./project-index.js";
import { prepareRename, renameProject } from "./rename.js";
import { completionContext, completionsAt } from "./completion.js";
import { hoverAt } from "./hover.js";
import { definitionAt, referencesAt } from "./definition.js";
import { documentDiagnostics, editorDiagnostics } from "./index.js";

export interface WorkspaceLocation {
  root: string;
  path: string;
  /** Configuration failures block analysis instead of silently selecting another root. */
  error?: string;
}

/** URI/filesystem policy belongs to the host, not the portable compiler. */
export interface WorkspaceHost {
  parseKalandraManifest?: ProjectHost["parseKalandraManifest"];
  resolveExternal?(
    root: string,
    dependency: Parameters<NonNullable<ProjectHost["resolveExternal"]>>[0],
    importer: string,
    overlays: ReadonlyMap<string, string>,
  ): ReturnType<NonNullable<ProjectHost["resolveExternal"]>>;
  locate(
    uri: string,
    overlays?: ReadonlyMap<string, string>,
  ): WorkspaceLocation | undefined | Promise<WorkspaceLocation | undefined>;
  isConfiguration?(uri: string): boolean;
  uri(root: string, path: string): string;
  read(root: string, path: string): Promise<string | null>;
  /** Complete discovery within the host's source policy; throw rather than return partial results. */
  listSources?(
    root: string,
    overlays?: ReadonlyMap<string, string>,
  ): Promise<readonly string[]>;
}

export class WorkspaceDocuments {
  private documents = new Map<string, TextDocument>();
  private generation = 0;
  private published = new Set<string>();
  private index: ProjectIndex;
  constructor(
    private host: WorkspaceHost,
    private publish: (report: PublishDiagnosticsParams) => void,
    private options: AnalysisOptions = {},
  ) {
    this.index = new ProjectIndex(options, 32, host.parseKalandraManifest);
  }
  async open(uri: string, languageId: string, version: number, text: string) {
    if (version <= (this.documents.get(uri)?.version ?? -Infinity)) return;
    this.documents.set(
      uri,
      TextDocument.create(uri, languageId, version, text),
    );
    await this.refresh();
  }
  async change(
    uri: string,
    version: number,
    changes: TextDocumentContentChangeEvent[],
  ) {
    const document = this.documents.get(uri);
    if (!document || version <= document.version) return;
    TextDocument.update(document, changes, version);
    await this.refresh();
  }
  async close(uri: string) {
    if (this.documents.delete(uri)) await this.refresh();
  }
  dispose() {
    this.generation++;
    this.documents.clear();
    this.index.clear();
  }
  async format(uri: string): Promise<TextEdit[]> {
    const document = this.documents.get(uri);
    if (!document || this.host.isConfiguration?.(uri)) return [];
    const version = document.version;
    const text = document.getText();
    const snapshot = TextDocument.create(
      uri,
      document.languageId,
      version,
      text,
    );
    // Yield before formatting so already queued buffer changes can supersede it.
    await Promise.resolve();
    if (this.documents.get(uri) !== document || document.version !== version)
      return [];
    const result = formatSource({ path: uri, text });
    if (result.text === undefined || result.text === text) return [];
    return [
      {
        range: {
          start: { line: 0, character: 0 },
          end: snapshot.positionAt(text.length),
        },
        newText: result.text,
      },
    ];
  }
  private async analysisSnapshot(
    uri: string,
    override?: string,
    projectWide = false,
  ) {
    const document = this.documents.get(uri);
    if (!document || this.host.isConfiguration?.(uri)) return null;
    const generation = this.generation;
    const text = override ?? document.getText();
    const snapshot = TextDocument.create(
      uri,
      document.languageId,
      document.version,
      text,
    );
    const overlays = new Map(
      [...this.documents].map(([uri, document]) => [uri, document.getText()]),
    );
    overlays.set(uri, text);
    const location = await this.host.locate(uri, overlays);
    if (generation !== this.generation) return null;
    let result: ProjectResult;
    if (location?.error) {
      result = {
        diagnostics: [
          { code: "KAL4301", severity: "error", message: location.error },
        ],
        sources: new Map([[location.path, { path: location.path, text }]]),
        modules: new Map(),
      };
    } else if (location) {
      const entries = new Set([location.path]);
      if (projectWide) {
        for (const uri of overlays.keys()) {
          const candidate = await this.host.locate(uri, overlays);
          if (!candidate?.error && candidate?.root === location.root)
            entries.add(candidate.path);
        }
        try {
          for (const path of (await this.host.listSources?.(
            location.root,
            overlays,
          )) ?? [])
            entries.add(path);
        } catch (error) {
          if (generation !== this.generation) return null;
          throw error;
        }
        if (generation !== this.generation) return null;
      }
      const reads = new Map<string, Promise<string | null>>();
      const sources = new Map<string, SourceFile>();
      const manifests = new Map<string, SourceFile>();
      const externals = new Map<string, string | ExternalResolution>();
      const resolveExternal = this.host.resolveExternal
        ? (
            dependency: Parameters<
              NonNullable<ProjectHost["resolveExternal"]>
            >[0],
            importer: string,
          ) =>
            this.host.resolveExternal!(
              location.root,
              dependency,
              importer,
              overlays,
            )
        : undefined;
      const modules = new Map<string, ProjectModule>();
      const diagnostics: ProjectResult["diagnostics"][number][] = [];
      for (const entry of entries) {
        if (modules.has(entry)) continue;
        const readSource = (path: string) => {
          const key = this.host.uri(location.root, path);
          if (overlays.has(key)) return Promise.resolve(overlays.get(key)!);
          if (!reads.has(key))
            reads.set(key, this.host.read(location.root, path));
          return reads.get(key)!;
        };
        const graph = projectWide
          ? await this.index.analyze(
              location.root,
              entry,
              readSource,
              resolveExternal,
            )
          : await analyzeProject(
              entry,
              {
                readSource,
                parseKalandraManifest: this.host.parseKalandraManifest,
                ...(resolveExternal ? { resolveExternal } : {}),
              },
              this.options,
            );
        if (generation !== this.generation) return null;
        for (const [key, resolution] of graph.externals ?? [])
          externals.set(key, resolution);
        for (const [path, manifest] of graph.manifests ?? [])
          manifests.set(path, manifest);
        for (const [path, source] of graph.sources) sources.set(path, source);
        for (const [path, module] of graph.modules) modules.set(path, module);
        diagnostics.push(...graph.diagnostics);
      }
      result = { sources, manifests, externals, modules, diagnostics };
    } else {
      const analysis = analyze({ path: uri, text }, this.options);
      result = {
        diagnostics: analysis.diagnostics,
        sources: new Map([[uri, { path: uri, text }]]),
        modules: new Map(
          analysis.model && analysis.program
            ? [
                [
                  uri,
                  {
                    program: analysis.program,
                    model: analysis.model,
                    dependencies: new Map(),
                  },
                ],
              ]
            : [],
        ),
      };
    }
    if (generation !== this.generation) return null;
    return { result, snapshot, location };
  }
  async prepareRename(uri: string, position: Position) {
    const analysis = await this.analysisSnapshot(uri, undefined, true);
    if (!analysis) return null;
    const selected = prepareRename(
      analysis.result,
      analysis.location?.path ?? uri,
      analysis.snapshot.offsetAt(position),
    );
    return selected
      ? {
          range: {
            start: analysis.snapshot.positionAt(selected.span.start),
            end: analysis.snapshot.positionAt(selected.span.end),
          },
          placeholder: selected.placeholder,
        }
      : null;
  }
  async rename(
    uri: string,
    position: Position,
    newName: string,
  ): Promise<WorkspaceEdit | null> {
    const generation = this.generation;
    const analysis = await this.analysisSnapshot(uri, undefined, true);
    if (!analysis) return null;
    const { result, snapshot, location } = analysis;
    let spans: SourceSpan[];
    try {
      spans = await renameProject(
        result,
        location?.path ?? uri,
        snapshot.offsetAt(position),
        newName,
        this.options,
        !!location,
        this.host.parseKalandraManifest,
      );
    } catch (error) {
      if (generation !== this.generation) return null;
      throw error;
    }
    if (generation !== this.generation) return null;
    const changes = new Map<string, TextDocumentEdit>();
    for (const span of spans) {
      const targetUri = location
        ? this.host.uri(location.root, span.file)
        : uri;
      const document = TextDocument.create(
        targetUri,
        "kalandra",
        0,
        result.sources.get(span.file)!.text,
      );
      if (!changes.has(targetUri))
        changes.set(targetUri, {
          textDocument: {
            uri: targetUri,
            version: this.documents.get(targetUri)?.version ?? null,
          },
          edits: [],
        });
      changes.get(targetUri)!.edits.push({
        range: {
          start: document.positionAt(span.start),
          end: document.positionAt(span.end),
        },
        newText: newName,
      });
    }
    return { documentChanges: [...changes.values()] };
  }
  async references(
    uri: string,
    position: Position,
    includeDeclaration: boolean,
  ): Promise<Location[]> {
    const analysis = await this.analysisSnapshot(uri, undefined, true);
    if (!analysis) return [];
    const { result, snapshot, location } = analysis;
    return referencesAt(
      result,
      location?.path ?? uri,
      snapshot.offsetAt(position),
      includeDeclaration,
    ).map((span) => {
      const targetUri = location
        ? this.host.uri(location.root, span.file)
        : uri;
      const target = TextDocument.create(
        targetUri,
        "kalandra",
        0,
        result.sources.get(span.file)!.text,
      );
      return {
        uri: targetUri,
        range: {
          start: target.positionAt(span.start),
          end: target.positionAt(span.end),
        },
      };
    });
  }
  async complete(uri: string, position: Position): Promise<CompletionItem[]> {
    const document = this.documents.get(uri);
    if (!document) return [];
    const original = TextDocument.create(
      uri,
      document.languageId,
      document.version,
      document.getText(),
    );
    const context = completionContext(
      original.getText(),
      original.offsetAt(position),
    );
    if (!context) return [];
    const analysis = await this.analysisSnapshot(uri, context.text);
    if (!analysis) return [];
    return completionsAt(
      analysis.result,
      analysis.location?.path ?? uri,
      context,
    ).map((item) => ({
      ...item,
      textEdit: {
        range: {
          start: original.positionAt(context.start),
          end: original.positionAt(context.end),
        },
        newText: item.label,
      },
    }));
  }
  async hover(uri: string, position: Position): Promise<Hover | null> {
    const analysis = await this.analysisSnapshot(uri);
    if (!analysis) return null;
    const { result, snapshot, location } = analysis;
    const hover = hoverAt(
      result,
      location?.path ?? uri,
      snapshot.offsetAt(position),
    );
    return hover
      ? {
          contents: { kind: "plaintext", value: hover.text },
          range: {
            start: snapshot.positionAt(hover.span.start),
            end: snapshot.positionAt(hover.span.end),
          },
        }
      : null;
  }
  async definition(uri: string, position: Position): Promise<Location | null> {
    const analysis = await this.analysisSnapshot(uri);
    if (!analysis) return null;
    const { result, snapshot, location } = analysis;
    const target = definitionAt(
      result,
      location?.path ?? uri,
      snapshot.offsetAt(position),
    );
    if (!target) return null;
    const targetUri = location
      ? this.host.uri(location.root, target.file)
      : uri;
    const source = result.sources.get(target.file);
    if (!source) return null;
    const targetDocument = TextDocument.create(
      targetUri,
      "kalandra",
      0,
      source.text,
    );
    return {
      uri: targetUri,
      range: {
        start: targetDocument.positionAt(target.start),
        end: targetDocument.positionAt(target.end),
      },
    };
  }
  async refresh() {
    const generation = ++this.generation;
    // TextDocument.update mutates; capture immutable text for this generation.
    const documents = new Map(
      [...this.documents].map(([uri, document]) => [
        uri,
        TextDocument.create(
          uri,
          document.languageId,
          document.version,
          document.getText(),
        ),
      ]),
    );
    const reports = new Map<string, PublishDiagnosticsParams>();
    const reads = new Map<string, Promise<string | null>>();
    const reportFor = (uri: string) => {
      if (!reports.has(uri))
        reports.set(uri, {
          uri,
          ...(documents.has(uri)
            ? { version: documents.get(uri)!.version }
            : {}),
          diagnostics: [],
        });
      return reports.get(uri)!;
    };
    const overlays = new Map(
      [...documents].map(([uri, document]) => [uri, document.getText()]),
    );
    for (const document of documents.values()) {
      reportFor(document.uri);
      if (this.host.isConfiguration?.(document.uri)) continue;
      const location = await this.host.locate(document.uri, overlays);
      if (generation !== this.generation) return;
      if (location?.error) {
        reportFor(document.uri).diagnostics.push({
          severity: 1,
          code: "KAL4301",
          source: "kalandra",
          message: location.error,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 },
          },
        });
        continue;
      }
      if (!location) {
        reportFor(document.uri).diagnostics.push(
          ...documentDiagnostics(document, this.options),
        );
        continue;
      }
      const result = await analyzeProject(
        location.path,
        {
          parseKalandraManifest: this.host.parseKalandraManifest,
          ...(this.host.resolveExternal
            ? {
                resolveExternal: (
                  dependency: Parameters<
                    NonNullable<ProjectHost["resolveExternal"]>
                  >[0],
                  importer: string,
                ) =>
                  this.host.resolveExternal!(
                    location.root,
                    dependency,
                    importer,
                    overlays,
                  ),
              }
            : {}),
          readSource: (path) => {
            const uri = this.host.uri(location.root, path);
            const overlay = documents.get(uri);
            if (overlay) return Promise.resolve(overlay.getText());
            if (!reads.has(uri))
              reads.set(uri, this.host.read(location.root, path));
            return reads.get(uri)!;
          },
        },
        this.options,
      );
      if (generation !== this.generation) return;
      for (const diagnostic of result.diagnostics) {
        const path = diagnostic.span?.file ?? location.path;
        const uri = this.host.uri(location.root, path);
        const source = result.sources.get(path);
        const buffer =
          documents.get(uri) ??
          TextDocument.create(uri, "kalandra", 0, source?.text ?? "");
        reportFor(uri).diagnostics.push(
          ...editorDiagnostics(buffer, [diagnostic]),
        );
      }
    }
    if (generation !== this.generation) return;
    for (const uri of this.published)
      if (!reports.has(uri)) reports.set(uri, { uri, diagnostics: [] });
    for (const report of reports.values()) {
      const unique = new Map(
        report.diagnostics.map((diagnostic) => [
          JSON.stringify(diagnostic),
          diagnostic,
        ]),
      );
      report.diagnostics = [...unique.values()];
      this.publish(report);
    }
    this.published = new Set(
      [...reports.values()]
        .filter((r) => documents.has(r.uri) || r.diagnostics.length)
        .map((r) => r.uri),
    );
  }
}
