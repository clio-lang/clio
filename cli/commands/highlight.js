const fs = require("fs");
const chalk = require("chalk");

exports.command = "highlight <source>";
exports.desc = "Highlight a Clio file";
exports.builder = {
  source: { describe: "source file to host", type: "string" }
};
exports.handler = function(argv) {
  fs.readFile(argv.source, "utf8", (err, contents) => {
    if (err) console.trace(err);
    console.log(highlight(contents));
  });
};

function highlight(text) {
  let patterns = [
    {
      pattern: /^fn +[a-z_][a-z_0-9]*/i,
      action: function(match, colorized) {
        let name = match.slice(2).trim(" ");
        let spaces = match.length - name.length - 2;
        colorized.push(chalk.magenta("fn"));
        colorized.push(chalk.white(" ".repeat(spaces)));
        colorized.push(chalk.blue(name));
      }
    },
    {
      pattern: /^type +[a-z_][a-z_0-9]*/i,
      action: function(match, colorized) {
        let name = match.slice(4).trim(" ");
        let spaces = match.length - name.length - 4;
        colorized.push(chalk.magenta("type"));
        colorized.push(chalk.white(" ".repeat(spaces)));
        colorized.push(chalk.blue(name));
      }
    },
    {
      color: chalk.magenta,
      pattern: /^(print|upper|map|pow|mul|add|div|sub)(?![a-zA-Z_-])/
    },
    {
      pattern: /^[-=]> +[a-z_][a-z_0-9]*/i,
      action: function(match, colorized) {
        let name = match.slice(2).trim(" ");
        let spaces = match.length - name.length - 2;
        colorized.push(chalk.magenta(match.slice(0, 2)));
        colorized.push(chalk.white(" ".repeat(spaces)));
        colorized.push(chalk.blue(name));
      }
    },
    {
      pattern: /^-> *\* *[a-z_][a-z_0-9]*/i,
      action: function(match, colorized) {
        let name = match.match(/[a-z_][a-z_0-9]*/)[0];
        let operator = match.match(/-> *\*/)[0];
        let spaces = match.length - name.length - operator.length;
        colorized.push(chalk.magenta(operator));
        colorized.push(chalk.white(" ".repeat(spaces)));
        colorized.push(chalk.blue(name));
      }
    },
    { color: chalk.gray, pattern: /^--.*?($|\n)/ },
    { color: chalk.green, pattern: /^#[^\[\] \r\n]+/i },
    {
      color: chalk.magenta,
      pattern: /^(fn|else|elif|if|of|return|not|or|and|transform|proc|import|from)(?![a-zA-Z_-])/
    },
    { color: chalk.yellow, pattern: /^(true|false)/ },
    { color: chalk.green, pattern: /^https?:[^ \r\n]+/ },
    { color: chalk.cyan, pattern: /^(->|=>)/ },
    { color: chalk.cyan, pattern: /^(!|!=|=|>|<|>=|<=)/ },
    { color: chalk.cyan, pattern: /^([\[\]()])/ },
    { color: chalk.cyan, pattern: /^[-+/*%^]/ },
    { color: chalk.cyan, pattern: /^(([@][a-z][a-z0-9_]*)|[.:@])/i },
    { color: chalk.yellow, pattern: /^(0|-?[1-9][0-9']*)(\.[0-9']+)?/ },
    { color: chalk.white, pattern: /^[a-z_][a-z_0-9]*('s? )?/i },
    { color: chalk.green, pattern: /^('([^\\]|\\.)*?'|:\S+)/ },
    { color: chalk.white, pattern: /^\S+/ },
    { color: chalk.white, pattern: /^(\r\n|[\r\n])/ },
    { color: chalk.white, pattern: /\s+/ }
  ];
  let colorized = [];
  let i = 0;
  while (i <= text.length) {
    for (let j = 0; j < patterns.length; j++) {
      let match = text.slice(i).match(patterns[j].pattern);
      if (match != null) {
        if (patterns[j].action != undefined) {
          patterns[j].action(match[0], colorized);
        } else {
          colorized.push(patterns[j].color(match[0]));
        }
        i += match[0].length - 1;
        break;
      }
    }
    i++;
  }
  return colorized.join("");
}
