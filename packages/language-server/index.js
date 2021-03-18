#!/usr/bin/env node

const ls = require("vscode-languageserver/node");
const doc = require("vscode-languageserver-textdocument");
const url = require("url");
const util = require("util");
const { parse } = require("clio-core");

const connection = ls.createConnection(ls.ProposedFeatures.all);
const documents = new ls.TextDocuments(doc.TextDocument);

const parses = new Map();

function updateParse(ev) {
  connection.console.info(`Parsing ${ev.document.uri}...`);
  const parsed = parse(ev.document.getText(), url.fileURLToPath(ev.document.uri));
  parses[ev.document.uri] = parsed;
  connection.console.log(util.inspect(parsed));
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
  updateParse(ev);
});

documents.onDidChangeContent(ev => {
  updateParse(ev);
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
