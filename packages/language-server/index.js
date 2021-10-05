#!/usr/bin/env node

import {
  CompletionItemKind,
  Diagnostic,
  DiagnosticSeverity,
  MarkupKind,
  ProposedFeatures,
  TextDocumentSyncKind,
  TextDocuments,
  createConnection,
} from "vscode-languageserver/node.js";
import { ImportError, ParsingError, TypeError } from "clio-core/errors.js";
import { MODULES_PATH, getPackageConfig } from "clio-manifest";
import { compileFile, tokenize } from "clio-core";
import { dirname, join, relative, resolve } from "path";

import { TextDocument } from "vscode-languageserver-textdocument";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { inspect } from "util";

const DEBUG_MODE = false;

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

const parses = new Map();

const getMessageFromError = (error) => {
  if (error instanceof ParsingError) {
    return error.meta.parseError;
  }
  if (error instanceof ImportError) {
    return error.meta.importError;
  }
  if (error instanceof TypeError) {
    return error.meta.typeError;
  }
  return error.message;
};

function errorToDiagnostic(error) {
  const { line, column } = error.meta;
  const message = getMessageFromError(error);
  const pos = {
    line: (line || 0) - 1,
    character: column || 0,
  };
  const range = { start: pos, end: { ...pos, character: 512 } }; // The end character is just an arbitrary large number
  return Diagnostic.create(range, message, DiagnosticSeverity.Error);
}

function getProjectRoot(file) {
  let currdir = dirname(file);
  while (true) {
    const up = resolve(currdir, "..");
    if (up === currdir) {
      return "";
    }
    if (existsSync(join(up, "clio.toml"))) {
      return up;
    }
    currdir = up;
  }
}

function getParentProjectRoot(file) {
  let currdir = dirname(file);
  let lastProjectDir = "";
  while (true) {
    const up = resolve(currdir, "..");
    if (up === currdir) {
      return lastProjectDir;
    }
    if (existsSync(join(up, "clio.toml"))) {
      lastProjectDir = up;
    }
    currdir = up;
  }
}

function updateParse(uri) {
  connection.console.info(`Parsing ${uri}...`);
  const diagnostics = [];
  try {
    const fileName = fileURLToPath(uri);
    const root = getProjectRoot(fileName);
    const configPath = join(root, "clio.toml");
    const config = getPackageConfig(configPath);
    const sourceDir = config.build.source;

    const parent = getParentProjectRoot(fileName);
    const parentConfigPath = join(parent, "clio.toml");
    const parentConfig = getPackageConfig(parentConfigPath);

    const cacheDir = join(parentConfig.build.destination, ".clio", "cache");
    const modulesDir = join(parentConfig.build.source, MODULES_PATH);
    const modulesDestDir = join(parentConfig.build.destination, MODULES_PATH);

    const relativeFile = relative(sourceDir, fileName);
    const moduleName = `${config.title}@${config.version}`;

    const srcPrefix =
      parentConfigPath === configPath ? "" : join(modulesDir, moduleName);
    const destPrefix =
      parentConfigPath === configPath ? "" : join(modulesDestDir, moduleName);

    const { scope } = compileFile(
      relativeFile,
      config,
      configPath,
      modulesDir,
      modulesDestDir,
      root,
      srcPrefix,
      destPrefix,
      cacheDir,
      { configs: {}, npmDeps: {}, npmDevDeps: {} }
    );

    parses.set(uri, scope);

    if (DEBUG_MODE) {
      connection.console.log(inspect(scope));
    }
  } catch (e) {
    const trace = errorToDiagnostic(e);
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
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {},
      hoverProvider: true,
    },
  };
});

connection.onCompletion((params) => {
  const keywordCompletions = [
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
    kind: CompletionItemKind.Keyword,
  }));

  const stored = parses.get(params.textDocument.uri) || {};
  const keys = Object.keys(stored);

  const functionCompletions = keys
    .filter((key) => stored[key].type === "Function")
    .map((label) => ({
      label,
      kind: CompletionItemKind.Function,
    }));

  const scopeSymbols = keys
    .filter((key) => stored[key].type !== "Function")
    .map((label) => ({
      label,
      kind: CompletionItemKind.Constant,
    }));

  return [...keywordCompletions, ...functionCompletions, ...scopeSymbols];
});

function linkedListToArray(ll) {
  const arr = [];
  let curr = ll.first;
  while (curr) {
    arr.push(curr.item);
    curr = curr.next;
  }
  return arr;
}

const getHoverMarkdown = (name, info) => {
  if (info.type === "Function") {
    return [
      `**Function ${name}**`,
      info.returns ? `- @returns ${info.returns}` : null,
      info.accepts ? `- @accepts ${info.accepts.join(" ")}` : null,
      info.params.length ? `- @params ${info.params.join(" ")}` : null,
      info.description ? `\n_${info.description}_` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }
  return info.type;
};

connection.onHover((params) => {
  const stored = parses.get(params.textDocument.uri);
  if (!stored) return null;

  const source = documents.get(params.textDocument.uri).getText();
  const tokens = tokenize(source, { file: params.textDocument.uri });
  const tokensArray = linkedListToArray(tokens);
  const pos = params.position;
  const token = tokensArray.find(
    (tok) =>
      tok.line - 1 === pos.line &&
      pos.character >= tok.column &&
      pos.character < tok.column + tok.value.length
  );

  const info = stored[token?.value];
  if (!info) return null;

  const markdown = getHoverMarkdown(token.value, info);

  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: markdown,
    },
    range: {
      start: { line: token.line - 1, character: token.column },
      end: {
        line: token.line - 1,
        character: token.column + token.value.length,
      },
    },
  };
});

documents.listen(connection);
connection.listen();
