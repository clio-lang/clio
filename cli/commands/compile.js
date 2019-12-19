const fs = require("fs");
const lexer = require("../../lexer/lexer");
const parser = require("../../parser/parser");
const beautify = require("js-beautify").js;
const analyzer = require("../../evaluator/analyzer");

exports.command = "compile <source> <destination>";
exports.desc = "Compile a Clio file";
exports.builder = {
  source: {
    describe: "source file to compile",
    type: "string"
  },
  destination: {
    describe: "destination file to write to",
    type: "string"
  }
};
exports.handler = function(argv) {
  compile(argv.source, argv.destination);
};

function compile(source, dest) {
  const contents = fs.readFileSync(source, "utf8");
  let tokens = lexer(contents);
  if (tokens[0] == false) {
    return;
  }
  tokens = tokens[1];
  try {
    const result = parser(contents, tokens, false, source);
    let ast = result[1];
    ast.pop(); // eof
    let code = beautify(analyzer(ast));

    writeFile(code, dest);
  } catch (e) {
    return e.exit ? e.exit() : console.log(e);
  }
}

function writeFile(source, path) {
  fs.writeFileSync(path, source);
}

exports.compile = compile;