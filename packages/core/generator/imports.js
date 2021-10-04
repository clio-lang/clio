import { dirname, join, relative, resolve } from "path";
import {
  getPackageConfig,
  getParsedNpmDependencies,
  getParsedNpmDevDependencies,
} from "clio-manifest";

import { SourceNode } from "source-map";
import { existsSync } from "fs";
import { importError } from "../errors.js";

const compileImport = (path, importPath, context) => {
  if (context.sourceDir) {
    const isModule = !path.match(/^(\.{1,2})?\//);
    const filePath = importPath.source;

    const {
      root,
      compileFile,
      config,
      configPath,
      modulesDir,
      modulesDestDir,
      srcPrefix,
      destPrefix,
      cacheDir,
      configs = {},
      npmDeps = {},
      npmDevDeps = {},
      imports = [],
    } = context;

    if (isModule) {
      // we need to get the config file
      const moduleName = path.split("/").shift();
      const configPath = join(root, modulesDir, moduleName, "clio.toml");
      const config = configs[moduleName] || getPackageConfig(configPath);
      configs[moduleName] = config;
      context.configs = configs;
      const srcPrefix = join(modulesDir, moduleName);
      const destPrefix = join(modulesDestDir, moduleName);
      if (!npmDeps[moduleName]) {
        npmDeps[moduleName] = getParsedNpmDependencies(configPath);
        context.npmDeps = npmDeps;
      }
      if (!npmDevDeps[moduleName]) {
        npmDevDeps[moduleName] = getParsedNpmDevDependencies(configPath);
        context.npmDevDeps = npmDevDeps;
      }
      const { scope, destFile, srcFile } = compileFile(
        filePath,
        config,
        configPath,
        modulesDir,
        modulesDestDir,
        root || dirname(configPath),
        srcPrefix,
        destPrefix,
        cacheDir,
        { npmDeps, npmDevDeps, configs }
      );
      imports.push({
        module: moduleName,
        src: srcFile,
        dest: destFile,
      });
      context.imports = imports;
      return scope;
    } else {
      const { scope, destFile, srcFile } = compileFile(
        filePath,
        config,
        configPath,
        modulesDir,
        modulesDestDir,
        root,
        srcPrefix,
        destPrefix,
        cacheDir,
        { npmDeps, npmDevDeps, configs }
      );
      imports.push({
        module: "",
        src: srcFile,
        dest: destFile,
      });
      context.imports = imports;
      return scope;
    }
  }
  return {};
};

const ensureClioExtension = (path) =>
  path.endsWith(".clio") ? path : path + ".clio";

const toRelative = (path) => (path.match(/^\.{1,2}\//) ? path : "./" + path);

const resolveRelativeModule = (context, path, line, column) => {
  const currDir = dirname(
    join(context.root, context.srcPrefix, context.sourceDir, context.file)
  );
  const possiblePaths = [];
  const resolvePath = resolve(currDir, path);

  if (!resolvePath.endsWith(".clio")) {
    possiblePaths.push(resolvePath + ".clio");
  } else {
    possiblePaths.push(resolvePath);
  }
  possiblePaths.push(join(resolvePath, "main.clio"));

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      if (path.match(/^\.{1,2}\//)) {
        return { source: path, require: path + ".js" };
      }
      const relativePath = relative(currDir, path);
      return {
        source: relativePath,
        require: toRelative(relativePath + ".js"),
      };
    }
  }

  throw importError({
    file: context.file,
    source: context.source,
    message: [
      `Cannot find module "${path}" in any of the following locations:\n`,
      ...possiblePaths.map(
        (path) => `  - ${relative(context.srcPrefix, path.source)}`
      ),
    ].join("\n"),
    line,
    column,
  });
};

const resolveAbsoluteModule = (context, path, line, column) => {
  const currDir = dirname(
    join(context.root, context.srcPrefix, context.sourceDir, context.file)
  );
  const possiblePaths = [];
  const resolvePath = resolve(
    context.root,
    context.srcPrefix,
    context.sourceDir,
    path.slice(1)
  );

  if (!resolvePath.endsWith(".clio")) {
    possiblePaths.push(resolvePath + ".clio");
  } else {
    possiblePaths.push(resolvePath);
  }
  possiblePaths.push(join(resolvePath, "main.clio"));

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      if (path.match(/^\.{1,2}\//)) {
        return { source: path, require: path + ".js" };
      }
      const relativePath = relative(currDir, path);
      return {
        source: relativePath,
        require: toRelative(relativePath + ".js"),
      };
    }
  }

  throw importError({
    file: context.file,
    source: context.source,
    message: [
      `Cannot find module "${path}" in any of the following locations:\n`,
      ...possiblePaths.map(
        (path) => `  - ${relative(context.root, path.source)}`
      ),
    ].join("\n"),
    line,
    column,
  });
};

const resolveModule = (context, path, line, column) => {
  const [moduleName, subPath = ""] = path.match(/(.*?)(?:$|\/(.*))/).slice(1);
  const modulePath = join(context.root, context.modulesDir, moduleName);
  if (!existsSync(modulePath)) {
    throw importError({
      file: context.file,
      source: context.source,
      message: [
        `Cannot find module "${moduleName}" in your project.`,
        "Are you sure it is installed?",
      ].join("\n"),
      line,
      column,
    });
  }

  const { source, destination } = context.config.build;
  const sourceDir = resolve(
    context.root,
    context.modulesDir,
    moduleName,
    source
  );
  const possiblePaths = [];
  const getResolvePath = (subPath) => {
    return {
      source: resolve(sourceDir, subPath),
      destination: resolve(
        context.modulesDestDir,
        moduleName,
        destination,
        subPath
      ),
    };
  };
  if (!subPath.endsWith(".clio")) {
    possiblePaths.push(getResolvePath(subPath + ".clio"));
  } else {
    possiblePaths.push(getResolvePath(subPath));
  }
  possiblePaths.push(getResolvePath(join(subPath, "main.clio")));

  for (const path of possiblePaths) {
    if (existsSync(path.source)) {
      if (path.destination.match(/^\.{1,2}\//)) {
        return { source: path.source, require: path.destination + ".js" };
      }
      const requirePath = toRelative(
        relative(dirname(context.destFile), path.destination) + ".js"
      );
      const sourcePath = relative(sourceDir, path.source);

      return {
        source: sourcePath,
        require: requirePath,
      };
    }
  }

  throw importError({
    file: context.file,
    source: context.source,
    message: [
      `Cannot find module "${path}" in any of the following locations:\n`,
      ...possiblePaths.map(
        (path) => `  - ${relative(context.root, path.source)}`
      ),
    ].join("\n"),
    line,
    column,
  });
};

const getImportPath = (context, path, line, column) => {
  if (!context.sourceDir) {
    const source = ensureClioExtension(path);
    return { source, require: source + ".js" };
  }
  if (path.match(/^\.{1,2}\//)) {
    return resolveRelativeModule(context, path, line, column);
  } else if (path.match(/^\//)) {
    return resolveAbsoluteModule(context, path, line, column);
  } else {
    return resolveModule(context, path, line, column);
  }
};

export const cjs = (node, context, get) => {
  /* each import has 2 parts:
        1. import
        2. assign
    */
  const path = node.path.value.slice(1, -1).replace(/^[^:]*:/, "");
  const filename = path.split("/").pop();
  // Get the name, and make it pascalCase
  const name = filename
    .replace(/\.[^.]*$/, "")
    .split("/")
    .pop()
    .replace(/@.*$/, "")
    .split(/[-._]+/)
    .filter(Boolean)
    .map((v, i) => (i > 0 ? v[0].toUpperCase() + v.slice(1) : v))
    .join("");

  const destructName = "default" + name[0].toUpperCase() + name.slice(1);
  const require = new SourceNode(
    node.import.line,
    node.import.column,
    node.import.file,
    ["import ", node.items ? destructName : name, " from ", '"', path, '"']
  );
  let assign = new SourceNode(null, null, null, "");
  if (node.items) {
    let parts = [];
    let rest;
    for (const part of node.items) {
      if (part.type === "symbol") {
        const name = get(part, context);
        parts.push(name);
      } else if (part.lhs.type === "symbol") {
        const name = get(part.lhs, context);
        const rename = get(part.rhs, context);
        parts.push(
          new SourceNode(part.as.line, part.as.column, part.as.file, [
            name,
            ":",
            rename,
          ])
        );
      } else {
        const name = get(part.rhs, context);
        rest = new SourceNode(part.as.line, part.as.column, part.as.file, [
          "...",
          name,
        ]);
        rest.name = name;
      }
    }
    if (rest) parts.push(rest);
    if (rest && parts.length == 1) {
      assign = new SourceNode(null, null, null, [
        "const ",
        rest.name,
        "=",
        destructName,
      ]);
    } else {
      assign = new SourceNode(null, null, null, [
        "const{",
        new SourceNode(null, null, null, parts).join(","),
        "}=",
        destructName,
      ]);
    }
  }
  assign.topLevel = require;
  return assign;
};

export const esm = (node, context, get) => {
  // check if there's rest
  const hasRest =
    node.items.length > 1 &&
    node.items.filter((item) => item.lhs.type === "mulOp").length === 1;

  if (hasRest) {
    return cjs(node, context, get);
  }

  const path = node.path.value.slice(1, -1).replace(/^[^:]*:/, "");
  const filename = path.split("/").pop();
  // Get the name, and make it pascalCase
  const name = filename
    .replace(/\.[^.]*$/, "")
    .split("/")
    .pop()
    .replace(/@.*$/, "")
    .split(/[-._]+/)
    .filter(Boolean)
    .map((v, i) => (i > 0 ? v[0].toUpperCase() + v.slice(1) : v))
    .join("");

  const require = new SourceNode(
    node.import.line,
    node.import.column,
    node.import.file,
    ["from ", '"', path, '"']
  );

  let assign;
  if (!node.items) {
    assign = new SourceNode(null, null, null, ["import ", name, " ", require]);
  } else {
    let parts = [];
    let rest;
    for (const part of node.items) {
      if (part.type === "symbol") {
        const name = get(part, context);
        parts.push(name);
      } else if (part.lhs.type === "symbol") {
        const name = get(part.lhs, context);
        const rename = get(part.rhs, context);
        parts.push(
          new SourceNode(part.as.line, part.as.column, part.as.file, [
            name,
            " as ",
            rename,
          ])
        );
      } else {
        const name = get(part.rhs, context);
        rest = new SourceNode(part.as.line, part.as.column, part.as.file, [
          "* as",
          name,
        ]);
        rest.name = name;
      }
    }
    if (rest) {
      assign = new SourceNode(null, null, null, [
        "import ",
        rest,
        " ",
        require,
      ]);
    } else {
      assign = new SourceNode(null, null, null, [
        "import{",
        new SourceNode(null, null, null, parts).join(","),
        "}",
        require,
      ]);
    }
  }
  const sn = new SourceNode(null, null, null, "");
  sn.topLevel = assign;
  return sn;
};

export const clio = (node, context, get) => {
  const path = node.path.value.slice(1, -1);
  const filename = path.split("/").pop();
  // Get the name, and make it pascalCase
  const name = filename
    .replace(/\.[^.]*$/, "")
    .split("/")
    .pop()
    .replace(/@.*$/, "")
    .split(/[-._]+/)
    .filter(Boolean)
    .map((v, i) => (i > 0 ? v[0].toUpperCase() + v.slice(1) : v))
    .join("");

  const destructName = "default" + name[0].toUpperCase() + name.slice(1);

  /*
    Resolve imports:

      1. Check if import is relative or not
      2. Check if import path exists
      3. Check if import path is a directory or not
      4. Check if we need to append .clio to the import path
  */

  const { line, column } = node.path;

  const importPath = getImportPath(context, path, line, column);
  const importScope = compileImport(path, importPath, context);

  const require = new SourceNode(
    node.import.line,
    node.import.column,
    node.import.file,
    ["import ", destructName, " from ", '"', importPath.require, '"']
  );

  let assign;
  if (!node.items) {
    assign = new SourceNode(null, null, null, [
      "const ",
      name,
      "=await ",
      destructName,
      "(clio)",
    ]);
    for (const key of Object.keys(importScope)) {
      context.scope[`${name}.${key}`] = importScope[key];
    }
  } else {
    let parts = [];
    let rest;
    for (const part of node.items) {
      if (part.type === "symbol") {
        const name = get(part, context);
        parts.push(name);
        if (importScope[name]) {
          context.scope[name] = importScope[name];
        }
      } else if (part.lhs.type === "symbol") {
        const name = get(part.lhs, context);
        const rename = get(part.rhs, context);
        parts.push(
          new SourceNode(part.as.line, part.as.column, part.as.file, [
            name,
            ":",
            rename,
          ])
        );
        if (importScope[name]) {
          context.scope[rename] = importScope[name];
        }
      } else {
        const name = get(part.rhs, context);
        rest = new SourceNode(part.as.line, part.as.column, part.as.file, [
          "...",
          name,
        ]);
        rest.name = name;
        const importedNames = node.items
          .filter(
            (item) => item.type === "symbol" || item.lhs?.type === "symbol"
          )
          .map((item) => {
            if (item.type === "symbol") {
              return get(item, context).toString();
            } else {
              return get(item.rhs, context).toString();
            }
          });
        for (const key of Object.keys(importScope)) {
          if (!importedNames.includes(key)) {
            context.scope[`${name}.${key}`] = importScope[key];
          }
        }
      }
    }
    if (rest) parts.push(rest);
    if (rest && parts.length == 1) {
      assign = new SourceNode(null, null, null, [
        "const ",
        rest.name,
        "=await ",
        destructName,
        "(clio)",
      ]);
    } else {
      assign = new SourceNode(null, null, null, [
        "const{",
        new SourceNode(null, null, null, parts).join(","),
        "}=await ",
        destructName,
        "(clio)",
      ]);
    }
  }
  assign.topLevel = require;
  return assign;
};

export const remote = (protocol, node, context, get) => {
  const path = node.path.value.slice(1, -1).replace(/^[^:]*:/, "");
  const filename = path.split("/").pop();
  // Get the name, and make it pascalCase
  const name = filename
    .replace(/\.[^.]*$/, "")
    .split("/")
    .pop()
    .replace(/@.*$/, "")
    .split(/[-._]+/)
    .filter(Boolean)
    .map((v, i) => (i > 0 ? v[0].toUpperCase() + v.slice(1) : v))
    .join("");

  const require = new SourceNode(
    node.import.line,
    node.import.column,
    node.import.file,
    ["await remote(clio,", '"', protocol + "://" + path, '")']
  );

  let assign;
  if (!node.items) {
    assign = new SourceNode(null, null, null, ["const ", name, "="]);
  } else {
    let parts = [];
    let rest;
    for (const part of node.items) {
      if (part.type === "symbol") {
        const name = get(part, context);
        parts.push(name);
      } else if (part.lhs.type === "symbol") {
        const name = get(part.lhs, context);
        const rename = get(part.rhs, context);
        parts.push(
          new SourceNode(part.as.line, part.as.column, part.as.file, [
            name,
            ":",
            rename,
          ])
        );
      } else {
        const name = get(part.rhs, context);
        rest = new SourceNode(part.as.line, part.as.column, part.as.file, [
          "...",
          name,
        ]);
        rest.name = name;
      }
    }
    if (rest) parts.push(rest);
    if (rest && parts.length == 1) {
      assign = new SourceNode(null, null, null, ["const ", rest.name, "="]);
    } else {
      assign = new SourceNode(null, null, null, [
        "const{",
        new SourceNode(null, null, null, parts).join(","),
        "}=",
      ]);
    }
  }
  return new SourceNode(null, null, null, [assign, require]);
};
