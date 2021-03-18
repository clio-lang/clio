#!/usr/bin/env node

const ls = require("vscode-languageserver/node");
const doc = require("vscode-languageserver-textdocument");
const url = require("url");
const util = require("util");
const { parse } = require("clio-core");

const DEBUG_MODE = false;

const connection = ls.createConnection(ls.ProposedFeatures.all);
const documents = new ls.TextDocuments(doc.TextDocument);

const parses = new Map();

function updateParse(uri, source) {
  connection.console.info(`Parsing ${uri}...`);
  let result = parse(source, url.fileURLToPath(uri));
  let diagnostics = [];

  if (result.traceback) {
    const traceLines = result.traceback.split("\n");
    const tracePattern = /Expecting\s+\S+\s+at\s+(\d+):(\d+).*/;
    const lastTrace = tracePattern.exec(traceLines[traceLines.length - 1]);
    if (lastTrace) {
      const [traceMsg, rawLine, rawColumn] = lastTrace;
      const pos = { line: parseInt(rawLine, 10), character: parseInt(rawColumn, 10) };
      const range = { start: pos, end: { ...pos, character: 512 } }; // The end character is just an arbitrary large number
      diagnostics.push(ls.Diagnostic.create(range, traceMsg, ls.DiagnosticSeverity.Error));
    }
  }

  parses[uri] = result;

  connection.sendDiagnostics({ uri, diagnostics });

  if (DEBUG_MODE) {
    connection.console.log(util.inspect(result));
  }
}

function findSourceNodeAtPos(node, line, column) {
  if (node.children) {
    for (const child of node.children) {
      const found = findSourceNodeAtPos(child, line, column);
      if (found) {
        return found;
      }
    }
  }

  if (line === node.line && column >= node.column && column < (node.column + node.source)) {
    return node;
  } else {
    return null;
  }
}

documents.onDidOpen(ev => {
  updateParse(ev.document.uri, ev.document.getText());
});

documents.onDidChangeContent(ev => {
  updateParse(ev.document.uri, ev.document.getText());
});

documents.onDidClose(ev => {
  parses.delete(ev.document.uri);
});

connection.onInitialize(params => {
  connection.console.info("Initializing Clio language server")
  return {
    capabilities: {
      textDocumentSync: ls.TextDocumentSyncKind.Incremental,
      completionProvider: {}
    }
  };
});

connection.onCompletion(params => {
  return [
    {
      label: "Test",
      kind: ls.CompletionItemKind.Method
    }
  ];
});

documents.listen(connection);
connection.listen();
