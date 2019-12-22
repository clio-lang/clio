const fs = require("fs");
const lexer = require("../../lexer/lexer");
const parser = require("../../parser/parser");
const beautify = require("js-beautify").js;
const analyzer = require("../../evaluator/analyzer");
const { error } = require("../lib/colors");

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
  try {
    if (!source) {
      throw new Error("The path to the Clio souce file is required.");
    }
    if (!fs.existsSync(source)) {
      throw new Error("The provided Clio source file does not exist.");
    }
    if (!dest) {
      throw new Error("The path to the compiled file is required.");
    }
    const contents = fs.readFileSync(source, "utf8");
    let tokens = lexer(contents);
    if (tokens[0] == false) {
      return;
    }
    tokens = tokens[1];
    const result = parser(contents, tokens, false, source);
    let ast = result[1];
    ast.pop(); // eof
    let code = beautify(analyzer(ast));

    fs.writeFileSync(dest, code);
  } catch (e) {
    return e.exit ? e.exit() : error(e);
  }
}

exports.compile = compile;
