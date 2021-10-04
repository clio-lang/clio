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

import { bean } from "bean-parser";
import { get } from "./types.js";
import lex from "./lexer.js";
import { parsingError } from "./errors.js";
import rules from "./rules.js";

export const parse = (tokens, context) => {
  try {
    const result = bean(tokens, rules, true, context);
    return result;
  } catch (error) {
    throw error;
  }
};

export const defaultScope = {
  Number: { id: "Number", type: "Type" },
  String: { id: "String", type: "Type" },
  Array: { id: "Array", type: "Type" },
  Any: { id: "Any", type: "Type" },
  Function: { id: "Function", type: "Type" },
  Type: { id: "Type", type: "Type" },
  ListType: { id: "ListType", type: "Type" },
};

export const compile = (source, file, { debug = false, ...ctx }) => {
  const context = {
    compile,
    compileFile,
    scope: { ...defaultScope },
    source,
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

export const mkdir = (directory) => {
  if (!existsSync(directory)) mkdirSync(directory, { recursive: true });
};

export const isFileModified = (src, dest, map, cache) => {
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

export const compileFile = (
  relativeFile,
  config,
  configPath,
  modulesDir,
  modulesDestDir,
  root,
  srcPrefix,
  destPrefix,
  cacheDir,
  transfer
) => {
  const cfgDest = getDestinationFromConfig(configPath, config);
  const cfgSrc = getSourceFromConfig(configPath, config);
  const destination = destPrefix
    ? join(root, destPrefix, cfgDest)
    : join(root, cfgDest);
  const sourceDir = srcPrefix
    ? join(root, srcPrefix, cfgSrc)
    : join(root, cfgSrc);
  const file = join(sourceDir, relativeFile);
  const rpcPrefix = `${config.title}@${config.version}`;
  const destFileClio = join(destination, relativeFile);
  const destFile = `${destFileClio}.js`;
  const mapFile = `${destFile}.map`;
  const cacheFile = join(root, cacheDir, `${destFile}.json`);
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
        ? join(root, modulesDir, moduleName, "clio.toml")
        : join(root, "clio.toml");
      if (!transfer.npmDeps[moduleName]) {
        transfer.npmDeps[moduleName] = getParsedNpmDependencies(configPath);
      }
      if (!transfer.npmDevDeps[moduleName]) {
        transfer.npmDevDeps[moduleName] =
          getParsedNpmDevDependencies(configPath);
      }
      const mapFile = `${dest}.map`;
      const cacheFile = join(root, cacheDir, `${dest}.json`);
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
          root,
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
    root,
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

export const tokenize = lex;
