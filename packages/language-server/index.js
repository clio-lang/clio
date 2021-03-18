#!/usr/bin/env node

const ls = require("vscode-languageserver/node");
const doc = require("vscode-languageserver-textdocument");
const url = require("url");
const { parse } = require("clio-core");

const connection = ls.createConnection(ls.ProposedFeatures.all);
const documents = new ls.TextDocuments(doc.TextDocument);

const parses = new Map();

documents.onDidOpen(ev => {
  connection.console.info(`Parsing ${ev.document.uri}...`);
  parses[ev.document.uri] = parse(ev.document.getText(), url.fileURLToPath(ev.document.uri));
});

documents.onDidChangeContent(ev => {
  connection.console.info(`Re-parsing ${ev.document.uri}...`);
  parses[ev.document.uri] = parse(ev.document.getText(), url.fileURLToPath(ev.document.uri));
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
