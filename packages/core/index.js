import { ImportError, get } from "./types.js";
import { dirname, join, relative } from "path";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "fs";
import {
  getDestinationFromConfig,
  getPackageConfig,
  getParsedNpmDependencies,
  getParsedNpmDevDependencies,
  getSourceFromConfig,
} from "clio-manifest";
import { importError, parsingError } from "./errors.js";

import { bean } from "bean-parser";
import lex from "./lexer.js";
import rules from "./rules.js";

const parse = (tokens, source, file, context) => {
  try {
    const result = bean(tokens, rules, true, context);
    return result;
  } catch (error) {
    if (error instanceof ImportError) {
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
    const clio = get(result.current.item, context);
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
  if (!existsSync(directory)) mkdirSync(directory, { recursive: true });
};

const isFileModified = (src, dest, map, cache) => {
  if (!existsSync(dest)) return true;
  if (!existsSync(map)) return true;
  if (!existsSync(cache)) return true;
  const srcMTime = statSync(src, { bigint: true }).mtimeMs;
  const destMTime = statSync(dest, { bigint: true }).mtimeMs;
  const mapMTime = statSync(map, { bigint: true }).mtimeMs;
  const cacheMTime = statSync(cache, { bigint: true }).mtimeMs;
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
  const destination = destPrefix ? join(destPrefix, cfgDest) : cfgDest;
  const sourceDir = srcPrefix ? join(srcPrefix, cfgSrc) : cfgSrc;
  const file = join(sourceDir, relativeFile);
  const rpcPrefix = `${config.title}@${config.version}`;
  const destFileClio = join(destination, relativeFile);
  const destFile = `${destFileClio}.js`;
  const mapFile = `${destFile}.map`;
  const cacheFile = join(cacheDir, `${destFile}.json`);
  const isModified = isFileModified(file, destFile, mapFile, cacheFile);
  if (!isModified) {
    const map = readFileSync(mapFile).toString();
    const code = readFileSync(destFile).toString();
    const { scope, imports = [] } = JSON.parse(
      readFileSync(cacheFile).toString()
    );
    // check if imports and configs are modified
    const importsToCheck = [...imports];
    while (importsToCheck.length) {
      const { src, dest, module: moduleName } = importsToCheck.pop();
      // TODO: This can be cached
      const configPath = moduleName
        ? join(modulesDir, moduleName, "clio.toml")
        : "clio.toml"; // TODO: Need project root here
      if (!transfer.npmDeps[moduleName]) {
        transfer.npmDeps[moduleName] = getParsedNpmDependencies(configPath);
      }
      if (!transfer.npmDevDeps[moduleName]) {
        transfer.npmDevDeps[moduleName] =
          getParsedNpmDevDependencies(configPath);
      }
      const mapFile = `${dest}.map`;
      const cacheFile = join(cacheDir, `${dest}.json`);
      const isModified = isFileModified(src, dest, mapFile, cacheFile);
      if (!isModified) {
        const { imports = [] } = JSON.parse(readFileSync(cacheFile).toString());
        importsToCheck.push(...imports);
      } else {
        // we need to compile it
        if (!transfer.configs[moduleName]) {
          transfer.configs[moduleName] = getPackageConfig(configPath);
        }
        const config = transfer.configs[moduleName];
        const contents = readFileSync(src, "utf8");
        const cfgDest = getDestinationFromConfig(configPath, config);
        const cfgSrc = getSourceFromConfig(configPath, config);
        const srcDir = join(dirname(configPath), cfgSrc);
        const relativeFile = relative(srcDir, src);
        const rpcPrefix = `${config.title}@${config.version}`;
        const { code, map, context } = compile(contents, relativeFile, {
          root: dirname(configPath),
          file: relativeFile,
          config,
          sourceDir: cfgSrc,
          modulesDir,
          modulesDestDir,
          rpcPrefix,
          destFile: dest,
          destination: cfgDest,
          configPath,
          srcPrefix: moduleName ? join(modulesDir, moduleName, cfgSrc) : "src", // TODO: rip
          destPrefix: moduleName
            ? join(modulesDestDir, moduleName, cfgDest)
            : "dest", // TODO: rip
          cacheDir,
          ...transfer,
        });
        mkdir(dirname(dest));
        mkdir(dirname(cacheFile));
        writeFileSync(
          cacheFile,
          JSON.stringify({
            scope: context.scope,
            imports: context.imports || [],
          }),
          "utf8"
        );
        writeFileSync(dest, code, "utf8");
        writeFileSync(mapFile, map, "utf8");
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
  const contents = readFileSync(file, "utf8");
  const { code, map, context } = compile(contents, relativeFile, {
    root: dirname(configPath),
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
  mkdir(dirname(destFile));
  mkdir(dirname(cacheFile));
  writeFileSync(
    cacheFile,
    JSON.stringify({ scope: context.scope, imports: context.imports || [] }),
    "utf8"
  );
  writeFileSync(destFile, code, "utf8");
  writeFileSync(mapFile, map, "utf8");
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

const _parse = parse;
export { _parse as parse };
const _compile = compile;
export { _compile as compile };
export const tokenize = lex;
const _compileFile = compileFile;
export { _compileFile as compileFile };
