const fs = require('fs');
const path = require('path');
const builtins = require('./builtins');

function write_file(source, path) {
  fs.writeFileSync(path, source);
}

// TODO: better path resolving!

function http_resolve_path(__basedir, path){
  path = path.replace(__basedir, '')
             .replace(/[^/]*\/\.\.(\/|$)/g, '')
             .replace(/\/\.(\/|$)/g, '/')
             .replace(/\/\/+/g, '/')
  return __basedir + path
}

function http_dir_name(path) {
  // assume resolved
  return path.replace(/\/[^/]*$/, '')
}

async function clio_require_browser(module_name, names_to_import, current_dir, scope) {
  const md5 = require('./md5');
  // __basedir is window.clio.__basedir || protocol://domain:port

  var __basedir = window.clio.__basedir || window.location.origin;
  var __filename = http_resolve_path(__basedir, `${current_dir}/${module_name}`);
  var __dirname = http_dir_name(__filename);
  //    ^ necessary for nested imports

  if (__filename.endsWith('.js')) {
    var mod = await fetch(__filename);
    var module = {
      exports: {}
    }
    var exports = module.exports;
    var source = await mod.text();
    eval(source);
    if (names_to_import.length == 0) {
      // import all
      var clio_module = {};
      module_name = module_name.replace(/.js$/, '').replace(/.*?\/+/, '');
      clio_module[module_name] = module.exports || exports;
    } else {
      var clio_module = {};
      names_to_import.forEach(function (name) {
        clio_module[name] = module.exports[name] || exports[name];
      })
    }
  } else if (__filename.indexOf('/') > -1) {
    if (!__filename.endsWith('.clio')) {
      __filename = `${__filename}.clio`
    }
    const exists = await fetch(__filename, {
      method: 'HEAD',
      cache: 'no-cache'
    });
    if (exists.status != 200) {
      var __filename = http_resolve_path(__basedir, `/clio_env/${module_name}.clio`);
      var __dirname = http_dir_name(__filename);
      var mod = await fetch(__filename);
    } else {
      var mod = await fetch(__filename);
    }
    var source = await mod.text();
    var source_hash = md5(source);
    var code = window.localStorage.getItem(`clio-compile-cache-${source_hash}`);
    if (!code) {
      code = window.clio.compile(source);
      window.localStorage.setItem(`clio-compile-cache-${source_hash}`, code);
    }
    var module = {};
    eval(code);
    // TODO: fix file arg for browser
    var mod = {};
    await module.exports(mod, window.clio.builtins);
    var clio_module = {};
    if (names_to_import.length == 0) {
      // import all
      var module_name = module_name.replace(/\.clio/, '').replace(/.*?\/+/, '');
      clio_module[module_name] = mod;
    } else {
      names_to_import.forEach(function (name) {
        clio_module[name] = mod[name];
      })
    }
  }
  Object.assign(scope, clio_module);
}

function resolve_path(path){
  return path.replace(/[^/]*\/\.\.(\/|$)/g, '')
             .replace(/\/\.(\/|$)/g, '/')
             .replace(/\/\/+/g, '/')
}

function make_module_paths() {
  var dir = process.cwd();
  var paths = [];
  while (true) {
    paths.push(path.join(dir, 'node_modules'));
    var _dir = path.dirname(dir);
    if (dir == _dir) {
      return paths;
    }
    dir = _dir;
  }
}

async function clio_require(module_name, names_to_import, current_dir, scope) {
  // TODO: must work for standard library
  // TODO: clio_require_browser is better written!
  current_dir = current_dir.replace(/\.clio-cache$/,'');

  if (module_name.endsWith('.js')) {
    var mod = require(path.join(current_dir, module_name));
    if (names_to_import.length == 0) {
      // import all
      var clio_module = {};
      module_name = module_name.replace(/\.js$/, '').replace(/.*?\/+/, '');
      clio_module[module_name] = mod;
    } else {
      var clio_module = {};
      names_to_import.forEach(function (name) {
        clio_module[name] = mod[name];
      })
    }
  } else if (module_name.endsWith('.clio')) {
    module_path = path.join(current_dir, module_name);
    if (!fs.existsSync(module_path)) {
      // switch to __basedir + clio_env + module_name
      module_path = path.join(__basedir, 'clio_env', module_name);
    }
    if (!fs.existsSync(module_path)) {
      // switch to __basedir + stdlib + module_name
      // TODO: respect Clio version in stdlib imports
      module_path = path.join(__basedir, 'clio_env', 'stdlib-master', `${module_name}.clio`);
    }
    if (fs.existsSync(module_path)) {
      var mod = await clio_import(module_path);
      if (names_to_import.length == 0) {
        // import all
        var clio_module = {};
        module_name = module_name.replace(/\.clio/, '').replace(/.*?\/+/, '');
        clio_module[module_name] = mod;
      } else {
        var clio_module = {};
        names_to_import.forEach(function (name) {
          clio_module[name] = mod[name];
        })
      }
    } else {
      throw "Module doesn't exist!"
    }
  } else if (module_name.indexOf('/') > -1) {
    // try importing .clio file first
    module_path = path.join(current_dir, `${module_name}.clio`);
    if (!fs.existsSync(module_path)) {
      // switch to main.clio
      module_path = path.join(__basedir, module_name, 'main.clio');
    }
    if (!fs.existsSync(module_path)) {
      // switch to __basedir + clio_env + module_name
      module_path = path.join(__basedir, 'clio_env', `${module_name}.clio`);
    }
    if (!fs.existsSync(module_path)) {
      // switch to __basedir + clio_env + module_name + main.clio
      module_path = path.join(__basedir, 'clio_env', module_name, main.clio);
    }
    if (!fs.existsSync(module_path)) {
      // switch to __basedir + stdlib + module_name
      // TODO: respect Clio version in stdlib imports
      module_path = path.join(__basedir, 'clio_env', 'stdlib-master', `${module_name}.clio`);
    }
    if (!fs.existsSync(module_path)) {
      // switch to __basedir + stdlib + module_name + main.clio
      // TODO: respect Clio version in stdlib imports
      module_path = path.join(__basedir, 'clio_env', 'stdlib-master', module_name, 'main.clio');
    }
    if (fs.existsSync(module_path)) {
      var mod = await clio_import(module_path);
      if (names_to_import.length == 0) {
        // import all
        var clio_module = {};
        module_name = module_name.replace(/.*?\/+/, '');
        clio_module[module_name] = mod;
      } else {
        var clio_module = {};
        names_to_import.forEach(function (name) {
          clio_module[name] = mod[name];
        })
      }
    } else {
      // we now try to import a node module instead
      const _paths = module.paths;
      try {
        module.paths = make_module_paths();
        var mod = require(module_name);
        if (names_to_import.length == 0) {
          // import all
          var clio_module = {};
          module_name = module_name.replace(/.*?\/+/, '');
          clio_module[module_name] = mod;
        } else {
          var clio_module = {};
          names_to_import.forEach(function (name) {
            clio_module[name] = mod[name];
          })
        }
      } catch (e) {
        throw e;
      } finally {
        module.paths = _paths;
      }
    }
  } else {
    // first try to import Clio module
    module_path = path.join(current_dir, `${module_name}.clio`);
    if (!fs.existsSync(module_path)) {
      // switch to main.clio
      module_path = path.join(__basedir, module_name, 'main.clio');
    }
    if (!fs.existsSync(module_path)) {
      // switch to __basedir + clio_env + module_name
      module_path = path.join(__basedir, 'clio_env', `${module_name}.clio`);
    }
    if (!fs.existsSync(module_path)) {
      // switch to __basedir + clio_env + module_name + main.clio
      module_path = path.join(__basedir, 'clio_env', module_name, main.clio);
    }
    if (!fs.existsSync(module_path)) {
      // switch to __basedir + stdlib + module_name
      // TODO: respect Clio version in stdlib imports
      module_path = path.join(__basedir, 'clio_env', 'stdlib-master', `${module_name}.clio`);
    }
    if (!fs.existsSync(module_path)) {
      // switch to __basedir + stdlib + module_name + main.clio
      // TODO: respect Clio version in stdlib imports
      module_path = path.join(__basedir, 'clio_env', 'stdlib-master', module_name, 'main.clio');
    }
    if (fs.existsSync(module_path)) {
      var mod = await clio_import(module_path);
      if (names_to_import.length == 0) {
        // import all
        var clio_module = {};
        clio_module[module_name] = mod;
      } else {
        var clio_module = {};
        names_to_import.forEach(function (name) {
          clio_module[name] = mod[name];
        })
      }
    } else {
      // Clio module doesn't exist, try loading node.js module
      const _paths = module.paths;
      try {
        module.paths = make_module_paths();
        var mod = require(module_name);
        if (names_to_import.length == 0) {
          // import all
          var clio_module = {};
          module_name = module_name.replace(/.*?\/+/, '');
          clio_module[module_name] = mod;
        } else {
          var clio_module = {};
          names_to_import.forEach(function (name) {
            clio_module[name] = mod[name];
          })
        }
      } catch (e) {
        throw e;
      } finally {
        module.paths = _paths;
      }
    }
  }
  Object.assign(scope, clio_module);
}

builtins.clio_require = clio_require;

async function do_import(file, direct) {

  const lexer = require('../lexer/lexer');
  const parser = require('../parser/parser');
  const analyzer = require('../evaluator/analyzer');
  const beautify = require('js-beautify').js;

  var contents = fs.readFileSync(file, 'utf8');
  var tokens = lexer(contents);
  if (tokens[0] == false) {
    return;
  }
  tokens = tokens[1];
  try {
    var result = parser(contents, tokens, false, file);
  } catch (e) {
    throw e;
  }
  var ast = result[1];
  ast.pop() // eof
  var code = beautify(analyzer(ast, contents));

  if (!path.isAbsolute(file)) {
    var cwd = process.cwd();
    var file = path.join(cwd, file);
  }
  var file_dir = path.dirname(file);
  var file_name = path.basename(file);
  var cache_dir = `${file_dir}${path.sep}.clio-cache`
  var cache_file = `${cache_dir}${path.sep}${file_name}.js`;
  if (!fs.existsSync(cache_dir)){
    fs.mkdirSync(cache_dir);
  }

  write_file(code, cache_file);
  cache_file = cache_file.replace(/\\/g, '/'); // windows fix |:
  return require(cache_file)({}, builtins, {source: contents, name: file_name}).catch(e => {throw e});  // because why not?
}

async function clio_import(file, direct) {
  if (!path.isAbsolute(file)) {
    var cwd = process.cwd();
    file = path.join(cwd, file);
  }
  var file_dir = path.dirname(file);
  if (direct) {
    global.__basedir = file_dir;
    process.chdir(file_dir);
  }
  var file_name = path.basename(file);
  var cache_dir = `${file_dir}${path.sep}.clio-cache`
  var cache_file = `${cache_dir}${path.sep}${file_name}.js`;
  if (!fs.existsSync(cache_dir)){
    fs.mkdirSync(cache_dir);
  }
  if (fs.existsSync(cache_file)) {
    var cache_stats = fs.statSync(cache_file);
    var source_stats = fs.statSync(file);
    if (cache_stats.mtime > source_stats.mtime) {
      cache_file = cache_file.replace(/\\/g, '/'); // windows fix |:
      var contents = fs.readFileSync(file, 'utf8');
      return require(cache_file)({}, builtins, {source: contents, name: file_name}).catch(e => {throw e});
    }
  }
  return do_import(file).catch(e => {throw e});
}

module.exports.clio_import = clio_import;
module.exports.clio_require_browser = clio_require_browser;
