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
    const pos = {
      line: parseInt(rawLine, 10),
      character: parseInt(rawColumn, 10),
    };
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
    "hash",
    "fn",
    "parallel",
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
        stored.tokens
          .filter((tok) => tok.name === "Symbol")
          .map((tok) => tok.raw)
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
