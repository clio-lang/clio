const fs = require("fs");
const lexer = require("../../lexer/lexer");
const parser = require("../../parser/parser");
const beautify = require("js-beautify").js;
const analyzer = require("../../evaluator/analyzer");

function compile(source, dest) {
  fs.readFile(source, "utf8", function(err, contents) {
    let tokens = lexer(contents);
    if (tokens[0] == false) {
      return;
    }
    tokens = tokens[1];
    try {
      var result = parser(contents, tokens, false, source);
    } catch (e) {
      return e.exit ? e.exit() : console.log(e);
    }
    let ast = result[1];
    ast.pop(); // eof
    let code = beautify(analyzer(ast, contents));

    writeFile(code, dest);
  });
}

function writeFile(source, path) {
  fs.writeFileSync(path, source);
}

module.exports = compile;
