#!/usr/bin/env node

const ls = require("vscode-languageserver/node");
const doc = require("vscode-languageserver-textdocument");
const url = require("url");
const util = require("util");
const { parse, tokenize } = require("clio-core");
const { parsingError } = require("clio-core/errors");

const DEBUG_MODE = false;

const connection = ls.createConnection(ls.ProposedFeatures.all);
const documents = new ls.TextDocuments(doc.TextDocument);

const parses = new Map();

function errorToDiagnostic(error) {
  const { message, line, column } = error;
  const pos = {
    line,
    character: column,
  };
  const range = { start: pos, end: { ...pos, character: 512 } }; // The end character is just an arbitrary large number
  return ls.Diagnostic.create(range, message, ls.DiagnosticSeverity.Error);
}

function linkedListToArray(ll) {
  const arr = [];
  let curr = ll.first;
  while (curr) {
    arr.push(curr.item);
    curr = curr.next;
  }
  return arr;
}

function updateParse(uri, source) {
  connection.console.info(`Parsing ${uri}...`);
  const diagnostics = [];
  try {
    const fileName = url.fileURLToPath(uri);
    const tokens = tokenize(source, fileName);
    const parsed = parse(source, tokens);

    parses[uri] = linkedListToArray(parsed);

    if (DEBUG_MODE) {
      connection.console.log(util.inspect(parsed));
    }

    if (parsed.first.item.type !== "clio") {
      throw parsingError(source, file, fileName);
    }
  } catch (e) {
    const trace = errorToDiagnostic(e.message);
    if (trace) {
      diagnostics.push(trace);
    }
  }

  connection.sendDiagnostics({ uri, diagnostics });
}

documents.onDidOpen((ev) => {
  updateParse(ev.document.uri, ev.document.getText());
});

documents.onDidChangeContent((ev) => {
  updateParse(ev.document.uri, ev.document.getText());
});

documents.onDidClose((ev) => {
  parses.delete(ev.document.uri);
});

connection.onInitialize(() => {
  connection.console.info("Initializing Clio language server");
  return {
    capabilities: {
      textDocumentSync: ls.TextDocumentSyncKind.Incremental,
      completionProvider: {},
      hoverProvider: true,
    },
  };
});

connection.onCompletion((params) => {
  const keywordCompletions = [
    "#",
    "fn",
    "and",
    "or",
    "not",
    "if",
    "else",
    "await",
    "import",
    "export",
    "from",
    "as",
  ].map((kw) => ({
    label: kw,
    kind: ls.CompletionItemKind.Keyword,
  }));

  const stored = parses[params.textDocument.uri];
  let functionCompletions = [];
  if (stored) {
    const symbols = [
      ...new Set(
        stored.filter((tok) => tok.name === "Symbol").map((tok) => tok.raw)
      ),
    ];
    functionCompletions = symbols.map((raw) => ({
      label: raw,
      kind: ls.CompletionItemKind.Function,
    }));
  }

  return [...keywordCompletions, ...functionCompletions];
});

connection.onHover((params) => {
  const pos = params.position;
  const stored = parses[params.textDocument.uri];
  if (!stored) return null;

  const token = stored.tokens.find(
    (tok) =>
      tok.line - 1 === pos.line &&
      pos.character >= tok.column &&
      pos.character < tok.column + tok.raw.length
  );
  if (!token) return null;

  return {
    contents: {
      kind: ls.MarkupKind.PlainText,
      value: token.name,
    },
    range: {
      start: { line: token.line - 1, character: token.column },
      end: { line: token.line - 1, character: token.column + token.raw.length },
    },
  };
});

documents.listen(connection);
connection.listen();
