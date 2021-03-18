#!/usr/bin/env node

const ls = require("vscode-languageserver/node");
const doc = require("vscode-languageserver-textdocument");

const connection = ls.createConnection(ls.ProposedFeatures.all);
const documents = new ls.TextDocuments(doc.TextDocument);

connection.onInitialize(params => {
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
