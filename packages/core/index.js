const { bean } = require("bean-parser");
const lex = require("./lexer");
const types = require("./types");
const rules = require("./rules");
const { parsingError, importError } = require("./errors");
const path = require("path");
const fs = require("fs");

const {
  getDestinationFromConfig,
  getSourceFromConfig,
} = require("clio-manifest");

const parse = (tokens, source, file, context) => {
  try {
    const result = bean(tokens, rules, true, context);
    return result;
  } catch (error) {
    if (error instanceof types.ImportError) {
      throw importError(source, file, error);
    }
    throw error;
  }
};

const defaultScope = {
  Number: { id: "Number", type: "Type" },
  String: { id: "String", type: "Type" },
  Array: { id: "Array", type: "Type" },
  Any: { id: "Any", type: "Type" },
  Function: { id: "Function", type: "Type" },
  Type: { id: "Type", type: "Type" },
  ListType: { id: "ListType", type: "Type" },
};

const compile = (source, file, { debug = false, ...ctx }) => {
  const context = {
    compile,
    compileFile,
    scope: { ...defaultScope },
    ...ctx,
  };
  const tokens = lex(source, { file });
  /* istanbul ignore next */
  if (debug) console.dir(tokens.current, { depth: null });
  const result = parse(tokens, source, file, context);
  /* istanbul ignore next */
  if (debug) console.dir(result, { depth: null });
  /* istanbul ignore next */
  if (result.first.item.type == "clio") {
    const clio = types.get(result.current.item, context);
    const { code, map } = clio.toStringWithSourceMap();
    map.setSourceContent(file, source);
    return {
      code: code + `//# sourceMappingURL=${file}.js.map`,
      map: map.toString(),
      scope: context.scope,
    };
    /* istanbul ignore next */
  } else {
    /* istanbul ignore next */
    throw parsingError(source, file, result);
  }
};

const mkdir = (directory) => {
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
};

const compileFile = (
  relativeFile,
  config,
  configPath,
  modulesDir,
  modulesDestDir,
  srcPrefix,
  destPrefix
) => {
  const cfgDest = getDestinationFromConfig(configPath, config);
  const cfgSrc = getSourceFromConfig(configPath, config);
  const destination = destPrefix ? path.join(destPrefix, cfgDest) : cfgDest;
  const sourceDir = srcPrefix ? path.join(srcPrefix, cfgSrc) : cfgSrc;
  const file = path.join(sourceDir, relativeFile);
  const rpcPrefix = `${config.title}@${config.version}`;
  const destFileClio = path.join(destination, relativeFile);
  const destFile = `${destFileClio}.js`;
  const mapFile = `${destFile}.map`;
  const scopeFile = `${destFileClio}.scope.json`;
  const isPreviouslyCompiled = [destFile, scopeFile, mapFile]
    .map((file) => fs.existsSync(file))
    .every(Boolean);
  if (isPreviouslyCompiled) {
    const srcMTime = fs.statSync(file, { bigint: true }).mtimeMs;
    const mapMTime = fs.statSync(mapFile, { bigint: true }).mtimeMs;
    const destMTime = fs.statSync(destFile, { bigint: true }).mtimeMs;
    const scopeMTime = fs.statSync(scopeFile, { bigint: true }).mtimeMs;
    const notModified = [mapMTime, destMTime, scopeMTime]
      .map((mtime) => mtime >= srcMTime)
      .every(Boolean);
    if (notModified) {
      const map = fs.readFileSync(mapFile).toString();
      const code = fs.readFileSync(destFile).toString();
      const scope = fs.readFileSync(scopeFile).toString();
      return { depsNpmDependencies: {}, code, map, scope: JSON.parse(scope) };
    }
  }
  const destDir = path.dirname(destFile);
  const contents = fs.readFileSync(file, "utf8");
  const { code, map, scope } = compile(contents, relativeFile, {
    root: path.dirname(configPath),
    file: relativeFile,
    config,
    sourceDir: cfgSrc,
    modulesDir,
    modulesDestDir,
    rpcPrefix,
    destFile,
    destination: cfgDest,
    configPath,
    srcPrefix,
    destPrefix,
  });
  mkdir(destDir);
  fs.writeFileSync(destFileClio, contents, "utf8");
  fs.writeFileSync(scopeFile, JSON.stringify(scope), "utf8");
  fs.writeFileSync(destFile, code, "utf8");
  fs.writeFileSync(mapFile, map, "utf8");
  return { depsNpmDependencies: {}, code, map, scope };
};

module.exports.parse = parse;
module.exports.compile = compile;
module.exports.tokenize = lex;
module.exports.compileFile = compileFile;
