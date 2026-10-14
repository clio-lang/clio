#!/usr/bin/env bun
import process from "node:process";
import {
  createConnection,
  TextDocumentSyncKind,
  ResponseError,
  ErrorCodes,
  LSPErrorCodes,
  type TextDocumentEdit,
} from "vscode-languageserver/node.js";
import { WorkspaceDocuments } from "./index.js";
import { SourceDiscoveryError } from "./source-discovery.js";
import { RenameError } from "./rename.js";
import { fileWorkspaceHost } from "./file-host.js";

const connection = createConnection(process.stdin, process.stdout);
let documents: WorkspaceDocuments;
let active = false;
let versionedEdits = false;
connection.onInitialize((params) => {
  const roots =
    params.workspaceFolders?.map((folder) => folder.uri) ??
    (params.rootUri ? [params.rootUri] : []);
  let host;
  try {
    host = fileWorkspaceHost(roots, {
      sourceExcludes: params.initializationOptions?.sourceExcludes,
    });
  } catch (error) {
    if (error instanceof SourceDiscoveryError)
      return new ResponseError(ErrorCodes.InvalidParams, error.message);
    throw error;
  }
  documents = new WorkspaceDocuments(
    host,
    (report) => {
      if (active) void connection.sendDiagnostics(report);
    },
    { strictNames: params.initializationOptions?.strictNames === true },
  );
  versionedEdits =
    params.capabilities.workspace?.workspaceEdit?.documentChanges === true;
  active = true;
  return {
    capabilities: {
      positionEncoding: "utf-16",
      definitionProvider: true,
      referencesProvider: true,
      renameProvider: { prepareProvider: true },
      hoverProvider: true,
      documentFormattingProvider: true,
      completionProvider: { triggerCharacters: ["."], resolveProvider: false },
      textDocumentSync: {
        openClose: true,
        save: true,
        change: TextDocumentSyncKind.Incremental,
      },
    },
    serverInfo: { name: "Kalandra", version: "0.13.0" },
  };
});
connection.onPrepareRename(async ({ textDocument, position }, token) => {
  if (!active || token.isCancellationRequested) return null;
  try {
    const result = await documents.prepareRename(textDocument.uri, position);
    return token.isCancellationRequested ? null : result;
  } catch (error) {
    if (token.isCancellationRequested) return null;
    if (error instanceof SourceDiscoveryError)
      return new ResponseError(LSPErrorCodes.RequestFailed, error.message);
    throw error;
  }
});
connection.onRenameRequest(
  async ({ textDocument, position, newName }, token) => {
    if (!active || token.isCancellationRequested) return null;
    try {
      const result = await documents.rename(
        textDocument.uri,
        position,
        newName,
      );
      if (token.isCancellationRequested || !result) return null;
      if (versionedEdits) return result;
      return {
        changes: Object.fromEntries(
          (result.documentChanges as TextDocumentEdit[]).map((change) => [
            change.textDocument.uri,
            change.edits,
          ]),
        ),
      };
    } catch (error) {
      if (token.isCancellationRequested) return null;
      if (error instanceof SourceDiscoveryError)
        return new ResponseError(LSPErrorCodes.RequestFailed, error.message);
      if (error instanceof RenameError)
        return new ResponseError(ErrorCodes.InvalidParams, error.message);
      throw error;
    }
  },
);
connection.onReferences(async ({ textDocument, position, context }, token) => {
  if (!active || token.isCancellationRequested) return [];
  try {
    const result = await documents.references(
      textDocument.uri,
      position,
      context.includeDeclaration,
    );
    return token.isCancellationRequested ? [] : result;
  } catch (error) {
    if (token.isCancellationRequested) return [];
    if (error instanceof SourceDiscoveryError)
      return new ResponseError(LSPErrorCodes.RequestFailed, error.message);
    throw error;
  }
});
connection.onDocumentFormatting(async ({ textDocument }, token) => {
  if (!active || token.isCancellationRequested) return [];
  const edits = await documents.format(textDocument.uri);
  return !active || token.isCancellationRequested ? [] : edits;
});
connection.onCompletion(({ textDocument, position }, token) => {
  if (!active || token.isCancellationRequested) return [];
  return documents
    .complete(textDocument.uri, position)
    .then((result) => (token.isCancellationRequested ? [] : result));
});
connection.onHover(({ textDocument, position }, token) => {
  if (!active || token.isCancellationRequested) return null;
  return documents
    .hover(textDocument.uri, position)
    .then((result) => (token.isCancellationRequested ? null : result));
});
connection.onDefinition(({ textDocument, position }, token) => {
  if (!active || token.isCancellationRequested) return null;
  return documents
    .definition(textDocument.uri, position)
    .then((result) => (token.isCancellationRequested ? null : result));
});
connection.onDidOpenTextDocument(({ textDocument }) => {
  if (!active) return;
  void documents.open(
    textDocument.uri,
    textDocument.languageId,
    textDocument.version,
    textDocument.text,
  );
});
connection.onDidChangeTextDocument(({ textDocument, contentChanges }) => {
  if (!active) return;
  void documents.change(textDocument.uri, textDocument.version, contentChanges);
});
connection.onDidCloseTextDocument(({ textDocument }) => {
  if (!active) return;
  void documents.close(textDocument.uri);
});
connection.onDidSaveTextDocument(() => {
  if (active) void documents.refresh();
});
connection.onDidChangeWatchedFiles(() => {
  if (active) void documents.refresh();
});
connection.onShutdown(() => {
  active = false;
  documents?.dispose();
});
connection.listen();
