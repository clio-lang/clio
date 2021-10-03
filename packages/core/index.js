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
  getPackageConfig,
  getParsedNpmDependencies,
  getParsedNpmDevDependencies,
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
      context,
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

const isFileModified = (src, dest, map, cache) => {
  if (!fs.existsSync(dest)) return true;
  if (!fs.existsSync(map)) return true;
  if (!fs.existsSync(cache)) return true;
  const srcMTime = fs.statSync(src, { bigint: true }).mtimeMs;
  const destMTime = fs.statSync(dest, { bigint: true }).mtimeMs;
  const mapMTime = fs.statSync(map, { bigint: true }).mtimeMs;
  const cacheMTime = fs.statSync(cache, { bigint: true }).mtimeMs;
  return [mapMTime, destMTime, cacheMTime]
    .map((mtime) => mtime <= srcMTime)
    .every(Boolean);
};

const compileFile = (
  relativeFile,
  config,
  configPath,
  modulesDir,
  modulesDestDir,
  srcPrefix,
  destPrefix,
  cacheDir,
  transfer
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
  const cacheFile = path.join(cacheDir, `${destFile}.json`);
  const isModified = isFileModified(file, destFile, mapFile, cacheFile);
  if (!isModified) {
    const map = fs.readFileSync(mapFile).toString();
    const code = fs.readFileSync(destFile).toString();
    const { scope, imports = [] } = JSON.parse(
      fs.readFileSync(cacheFile).toString()
    );
    // check if imports and configs are modified
    const importsToCheck = [...imports];
    while (importsToCheck.length) {
      const { src, dest, module: moduleName } = importsToCheck.pop();
      // TODO: This can be cached
      const configPath = moduleName
        ? path.join(modulesDir, moduleName, "clio.toml")
        : "clio.toml"; // TODO: Need project root here
      if (!transfer.npmDeps[moduleName]) {
        transfer.npmDeps[moduleName] = getParsedNpmDependencies(configPath);
      }
      if (!transfer.npmDevDeps[moduleName]) {
        transfer.npmDevDeps[moduleName] =
          getParsedNpmDevDependencies(configPath);
      }
      const mapFile = `${dest}.map`;
      const cacheFile = path.join(cacheDir, `${dest}.json`);
      const isModified = isFileModified(src, dest, mapFile, cacheFile);
      if (!isModified) {
        const { imports = [] } = JSON.parse(
          fs.readFileSync(cacheFile).toString()
        );
        importsToCheck.push(...imports);
      } else {
        // we need to compile it
        if (!transfer.configs[moduleName]) {
          transfer.configs[moduleName] = getPackageConfig(configPath);
        }
        const config = transfer.configs[moduleName];
        const contents = fs.readFileSync(src, "utf8");
        const cfgDest = getDestinationFromConfig(configPath, config);
        const cfgSrc = getSourceFromConfig(configPath, config);
        const srcDir = path.join(path.dirname(configPath), cfgSrc);
        const relativeFile = path.relative(srcDir, src);
        const rpcPrefix = `${config.title}@${config.version}`;
        const { code, map, context } = compile(contents, relativeFile, {
          root: path.dirname(configPath),
          file: relativeFile,
          config,
          sourceDir: cfgSrc,
          modulesDir,
          modulesDestDir,
          rpcPrefix,
          destFile: dest,
          destination: cfgDest,
          configPath,
          srcPrefix: moduleName
            ? path.join(modulesDir, moduleName, cfgSrc)
            : "src", // TODO: rip
          destPrefix: moduleName
            ? path.join(modulesDestDir, moduleName, cfgDest)
            : "dest", // TODO: rip
          cacheDir,
          ...transfer,
        });
        mkdir(path.dirname(dest));
        mkdir(path.dirname(cacheFile));
        fs.writeFileSync(
          cacheFile,
          JSON.stringify({
            scope: context.scope,
            imports: context.imports || [],
          }),
          "utf8"
        );
        fs.writeFileSync(dest, code, "utf8");
        fs.writeFileSync(mapFile, map, "utf8");
        importsToCheck.push(...imports);
      }
    }
    return {
      npmDeps: transfer.npmDeps || {},
      npmDevDeps: transfer.npmDevDeps || {},
      code,
      map,
      scope,
      imports,
      destFile,
      srcFile: file,
    };
  }
  const contents = fs.readFileSync(file, "utf8");
  const { code, map, context } = compile(contents, relativeFile, {
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
    cacheDir,
    ...transfer,
  });
  mkdir(path.dirname(destFile));
  mkdir(path.dirname(cacheFile));
  fs.writeFileSync(
    cacheFile,
    JSON.stringify({ scope: context.scope, imports: context.imports || [] }),
    "utf8"
  );
  fs.writeFileSync(destFile, code, "utf8");
  fs.writeFileSync(mapFile, map, "utf8");
  return {
    npmDeps: context.npmDeps || {},
    npmDevDeps: context.npmDevDeps || {},
    code,
    map,
    scope: context.scope,
    imports: context.imports,
    destFile,
    srcFile: file,
  };
};

module.exports.parse = parse;
module.exports.compile = compile;
module.exports.tokenize = lex;
module.exports.compileFile = compileFile;
