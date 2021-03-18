#!/usr/bin/env node

const ls = require("vscode-languageserver/node");
const doc = require("vscode-languageserver-textdocument");
const url = require("url");
const util = require("util");
const { parse, tokenize } = require("clio-core");

const DEBUG_MODE = false;

const connection = ls.createConnection(ls.ProposedFeatures.all);
const documents = new ls.TextDocuments(doc.TextDocument);

const parses = new Map();

function traceLineToDiagnostic(traceLine) {
  const tracePattern = /Expecting\s+\S+\s+at\s+(\d+):(\d+).*/;
  const trace = tracePattern.exec(traceLine);
  if (trace) {
    const [traceMsg, rawLine, rawColumn] = trace;
    const pos = { line: parseInt(rawLine, 10), character: parseInt(rawColumn, 10) };
    const range = { start: pos, end: { ...pos, character: 512 } }; // The end character is just an arbitrary large number
    return ls.Diagnostic.create(range, traceMsg, ls.DiagnosticSeverity.Error);
  } else {
    return null;
  }
}

function updateParse(uri, source) {
  connection.console.info(`Parsing ${uri}...`);
  const diagnostics = [];
  try {
    const tokens = tokenize(source, url.fileURLToPath(uri));
    const parsed = parse(source, tokens);
    const result = { tokens, parsed };
    parses[uri] = result;

    if (parsed.traceback) {
      const traceLines = parsed.traceback.split("\n");
      const trace = traceLineToDiagnostic(traceLines[traceLines.length - 1]);
      if (trace) {
        diagnostics.push(trace);
      }
    }

    if (DEBUG_MODE) {
      connection.console.log(util.inspect(result));
    }
  } catch (e) {
    if (e.message) {
      const trace = traceLineToDiagnostic(e.message);
      if (trace) {
        diagnostics.push(trace);
      }
    }
  }

  connection.sendDiagnostics({ uri, diagnostics });
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
