const fs = require("fs");
const path = require("path");
const builtins = require("./builtins");

function writeFile(source, path) {
  fs.writeFileSync(path, source);
}

// TODO: better path resolving!

function httpResolvePath(__basedir, path) {
  path = path
    .replace(__basedir, "")
    .replace(/[^/]*\/\.\.(\/|$)/g, "")
    .replace(/\/\.(\/|$)/g, "/")
    .replace(/\/\/+/g, "/");
  return __basedir + path;
}

function http_dir_name(path) {
  // assume resolved
  return path.replace(/\/[^/]*$/, "");
}

async function clioRequireBrowser(
  moduleName,
  namesToImport,
  currentDir,
  scope
) {
  const md5 = require("./md5");
  // __basedir is window.clio.__basedir || protocol://domain:port

  let __basedir = window.clio.__basedir || window.location.origin;
  let __filename = httpResolvePath(__basedir, `${currentDir}/${moduleName}`);

  if (__filename.endsWith(".js")) {
    const mod = await fetch(__filename);
    const module = {
      exports: {}
    };
    let exports = module.exports;
    const source = await mod.text();
    eval(source);
    if (namesToImport.length == 0) {
      // import all
      const clioModule = {};
      moduleName = moduleName.replace(/.js$/, "").replace(/.*?\/+/, "");
      clioModule[moduleName] = module.exports || exports;
    } else {
      const clioModule = {};
      namesToImport.forEach(function(name) {
        clioModule[name] = module.exports[name] || exports[name];
      });
    }
  } else if (__filename.indexOf("/") > -1) {
    if (!__filename.endsWith(".clio")) {
      __filename = `${__filename}.clio`;
    }
    const exists = await fetch(__filename, {
      method: "HEAD",
      cache: "no-cache"
    });
    if (exists.status != 200) {
      __filename = httpResolvePath(__basedir, `/clio_env/${moduleName}.clio`);
      let __dirname = http_dir_name(__filename);
      var mod = await fetch(__filename);
    } else {
      var mod = await fetch(__filename);
    }
    var source = await mod.text();
    let source_hash = md5(source);
    let code = window.localStorage.getItem(`clio-compile-cache-${source_hash}`);
    if (!code) {
      code = window.clio.compile(source);
      window.localStorage.setItem(`clio-compile-cache-${source_hash}`, code);
    }
    var module = {};
    eval(code);
    // TODO: fix file arg for browser
    var mod = {};
    await module.exports(mod, window.clio.builtins);
    var clioModule = {};
    if (namesToImport.length == 0) {
      // import all
      var moduleName = moduleName.replace(/\.clio/, "").replace(/.*?\/+/, "");
      clioModule[moduleName] = mod;
    } else {
      namesToImport.forEach(function(name) {
        clioModule[name] = mod[name];
      });
    }
  }
  Object.assign(scope, clioModule);
}

function resolve_path(path) {
  return path
    .replace(/[^/]*\/\.\.(\/|$)/g, "")
    .replace(/\/\.(\/|$)/g, "/")
    .replace(/\/\/+/g, "/");
}

function makeModulePaths() {
  let dir = process.cwd();
  let paths = [];
  while (true) {
    paths.push(path.join(dir, "node_modules"));
    let _dir = path.dirname(dir);
    if (dir == _dir) {
      return paths;
    }
    dir = _dir;
  }
}

async function clioRequire(moduleName, namesToImport, currentDir, scope) {
  // TODO: must work for standard library
  // TODO: clio_require_browser is better written!
  currentDir = currentDir.replace(/\.clio-cache$/, "");

  if (moduleName.endsWith(".js")) {
    const mod = require(path.join(currentDir, moduleName));
    let clioModule = {};
    if (namesToImport.length == 0) {
      // import all
      moduleName = moduleName.replace(/\.js$/, "").replace(/.*?\/+/, "");
      clioModule[moduleName] = mod;
    } else {
      namesToImport.forEach(function(name) {
        clioModule[name] = mod[name];
      });
    }
  } else if (moduleName.endsWith(".clio")) {
    module_path = path.join(currentDir, moduleName);
    if (!fs.existsSync(module_path)) {
      // switch to __basedir + clio_env + module_name
      module_path = path.join(__basedir, "clio_env", moduleName);
    }
    if (!fs.existsSync(module_path)) {
      // switch to __basedir + stdlib + module_name
      // TODO: respect Clio version in stdlib imports
      module_path = path.join(
        __basedir,
        "clio_env",
        "stdlib-master",
        `${moduleName}.clio`
      );
    }
    if (fs.existsSync(module_path)) {
      const mod = await clioImport(module_path);
      if (namesToImport.length == 0) {
        // import all
        const clioModule = {};
        moduleName = moduleName.replace(/\.clio/, "").replace(/.*?\/+/, "");
        clioModule[moduleName] = mod;
      } else {
        const clioModule = {};
        namesToImport.forEach(function(name) {
          clioModule[name] = mod[name];
        });
      }
    } else {
      throw "Module doesn't exist!";
    }
  } else if (moduleName.indexOf("/") > -1) {
    // try importing .clio file first
    module_path = path.join(currentDir, `${moduleName}.clio`);
    if (!fs.existsSync(module_path)) {
      // switch to main.clio
      module_path = path.join(__basedir, moduleName, "main.clio");
    }
    if (!fs.existsSync(module_path)) {
      // switch to __basedir + clio_env + module_name
      module_path = path.join(__basedir, "clio_env", `${moduleName}.clio`);
    }
    if (!fs.existsSync(module_path)) {
      // switch to __basedir + clio_env + module_name + main.clio
      module_path = path.join(__basedir, "clio_env", moduleName, "main.clio");
    }
    if (!fs.existsSync(module_path)) {
      // switch to __basedir + stdlib + module_name
      // TODO: respect Clio version in stdlib imports
      module_path = path.join(
        __basedir,
        "clio_env",
        "stdlib-master",
        `${moduleName}.clio`
      );
    }
    if (!fs.existsSync(module_path)) {
      // switch to __basedir + stdlib + module_name + main.clio
      // TODO: respect Clio version in stdlib imports
      module_path = path.join(
        __basedir,
        "clio_env",
        "stdlib-master",
        moduleName,
        "main.clio"
      );
    }
    if (fs.existsSync(module_path)) {
      const mod = await clioImport(module_path);
      if (namesToImport.length == 0) {
        // import all
        const clioModule = {};
        moduleName = moduleName.replace(/.*?\/+/, "");
        clioModule[moduleName] = mod;
      } else {
        const clioModule = {};
        namesToImport.forEach(function(name) {
          clioModule[name] = mod[name];
        });
      }
    } else {
      // we now try to import a node module instead
      const _paths = module.paths;
      try {
        module.paths = makeModulePaths();
        const mod = require(moduleName);
        if (namesToImport.length == 0) {
          // import all
          var clioModule = {};
          moduleName = moduleName.replace(/.*?\/+/, "");
          clioModule[moduleName] = mod;
        } else {
          var clioModule = {};
          namesToImport.forEach(function(name) {
            clioModule[name] = mod[name];
          });
        }
      } catch (e) {
        throw e;
      } finally {
        module.paths = _paths;
      }
    }
  } else {
    // first try to import Clio module
    module_path = path.join(currentDir, `${moduleName}.clio`);
    if (!fs.existsSync(module_path)) {
      // switch to main.clio
      module_path = path.join(__basedir, moduleName, "main.clio");
    }
    if (!fs.existsSync(module_path)) {
      // switch to __basedir + clio_env + module_name
      module_path = path.join(__basedir, "clio_env", `${moduleName}.clio`);
    }
    if (!fs.existsSync(module_path)) {
      // switch to __basedir + clio_env + module_name + main.clio
      module_path = path.join(__basedir, "clio_env", moduleName, "main.clio");
    }
    if (!fs.existsSync(module_path)) {
      // switch to __basedir + stdlib + module_name
      // TODO: respect Clio version in stdlib imports
      module_path = path.join(
        __basedir,
        "clio_env",
        "stdlib-master",
        `${moduleName}.clio`
      );
    }
    if (!fs.existsSync(module_path)) {
      // switch to __basedir + stdlib + module_name + main.clio
      // TODO: respect Clio version in stdlib imports
      module_path = path.join(
        __basedir,
        "clio_env",
        "stdlib-master",
        moduleName,
        "main.clio"
      );
    }
    if (fs.existsSync(module_path)) {
      var mod = await clioImport(module_path);
      if (namesToImport.length == 0) {
        // import all
        var clioModule = {};
        clioModule[moduleName] = mod;
      } else {
        var clioModule = {};
        namesToImport.forEach(function(name) {
          clioModule[name] = mod[name];
        });
      }
    } else {
      // Clio module doesn't exist, try loading node.js module
      const _paths = module.paths;
      try {
        module.paths = makeModulePaths();
        var mod = require(moduleName);
        if (namesToImport.length == 0) {
          // import all
          var clioModule = {};
          moduleName = moduleName.replace(/.*?\/+/, "");
          clioModule[moduleName] = mod;
        } else {
          var clioModule = {};
          namesToImport.forEach(function(name) {
            clioModule[name] = mod[name];
          });
        }
      } catch (e) {
        throw e;
      } finally {
        module.paths = _paths;
      }
    }
  }
  Object.assign(scope, clioModule);
}

builtins.clio_require = clioRequire;

async function doImport(file, direct) {
  const lexer = require("../lexer/lexer");
  const parser = require("../parser/parser");
  const analyzer = require("../evaluator/analyzer");
  const beautify = require("js-beautify").js;

  let contents = fs.readFileSync(file, "utf8");
  let tokens = lexer(contents);
  if (tokens[0] == false) {
    return;
  }
  tokens = tokens[1];
  try {
    var result = parser(contents, tokens, false, file);
  } catch (e) {
    throw e;
  }
  let ast = result[1];
  ast.pop(); // eof
  let code = beautify(analyzer(ast, contents));

  if (!path.isAbsolute(file)) {
    let cwd = process.cwd();
    var file = path.join(cwd, file);
  }
  let file_dir = path.dirname(file);
  let fileName = path.basename(file);
  let cache_dir = `${file_dir}${path.sep}.clio-cache`;
  let cacheFile = `${cache_dir}${path.sep}${fileName}.js`;
  if (!fs.existsSync(cache_dir)) {
    fs.mkdirSync(cache_dir);
  }

  writeFile(code, cacheFile);
  cacheFile = cacheFile.replace(/\\/g, "/"); // windows fix |:
  return require(cacheFile)({}, builtins, {
    source: contents,
    name: fileName
  }).catch(e => {
    throw e;
  }); // because why not?
}

async function clioImport(file, direct) {
  if (!path.isAbsolute(file)) {
    let cwd = process.cwd();
    file = path.join(cwd, file);
  }
  let file_dir = path.dirname(file);
  if (direct) {
    global.__basedir = file_dir;
    process.chdir(file_dir);
  }
  let fileName = path.basename(file);
  let cache_dir = `${file_dir}${path.sep}.clio-cache`;
  let cacheFile = `${cache_dir}${path.sep}${fileName}.js`;
  if (!fs.existsSync(cache_dir)) {
    fs.mkdirSync(cache_dir);
  }
  if (fs.existsSync(cacheFile)) {
    let cacheStats = fs.statSync(cacheFile);
    let sourceStats = fs.statSync(file);
    if (cacheStats.mtime > sourceStats.mtime) {
      cacheFile = cacheFile.replace(/\\/g, "/"); // windows fix |:
      let contents = fs.readFileSync(file, "utf8");
      return require(cacheFile)({}, builtins, {
        source: contents,
        name: fileName
      }).catch(e => {
        throw e;
      });
    }
  }
  return doImport(file).catch(e => {
    throw e;
  });
}

module.exports.clioImport = clioImport;
module.exports.clioRequireBrowser = clioRequireBrowser;
