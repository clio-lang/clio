const fs = require('fs');
const path = require('path');
const lexer = require('../lexer/lexer');
const parser = require('../parser/parser');
const analyzer = require('../evaluator/analyzer');
const builtins = require('./builtins');
const beautify = require('js-beautify').js;

function write_file(source, path) {
  fs.writeFileSync(path, source);
}

async function clio_require(module_name, names_to_import, current_dir, scope) {
  // TODO: must work in browser (http imports)
  // TODO: must accept $scope and write to it directly
  // TODO: must work for internals, built-in modules, relative imports
  // TODO: should be able to import js files
  current_dir = current_dir.replace(/\.clio-cache$/,'');
  module_path = path.join(current_dir, `${module_name}.clio`);
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
  }
  //var clio_module = require(path.join(process.env.clio_root, 'internals', module_name));
  Object.assign(scope, clio_module);
}

builtins.clio_require = clio_require;

function do_import(file) {
  var contents = fs.readFileSync(file, 'utf8');
  var tokens = lexer(contents);
  if (tokens[0] == false) {
    return;
  }
  tokens = tokens[1];
  var result = parser(contents, tokens);
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

function clio_import(file) {
  if (!path.isAbsolute(file)) {
    var cwd = process.cwd();
    file = path.join(cwd, file);
  }
  var file_dir = path.dirname(file);
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

module.exports = clio_import;
