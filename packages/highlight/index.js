import { existsSync, readFileSync } from "fs";

import chalk from "chalk";

const { blue, cyan, gray, green, magenta, white, yellow } = chalk;

export function highlight(source) {
  if (!source) {
    throw new Error("The path to the Clio souce file is required.");
  }
  if (!existsSync(source)) {
    throw new Error("The provided Clio source file does not exist.");
  }
  const contents = readFileSync(source, "utf8");
  return colorize(contents);
}

export function colorize(text) {
  let patterns = [
    {
      pattern: /^fn +[a-z_][a-z_0-9]*/i,
      action: function (match, colorized) {
        let name = match.slice(2).trim(" ");
        let spaces = match.length - name.length - 2;
        colorized.push(magenta("fn"));
        colorized.push(white(" ".repeat(spaces)));
        colorized.push(blue(name));
      },
    },
    {
      pattern: /^[-=]> +[a-z_][a-z_0-9]*/i,
      action: function (match, colorized) {
        let name = match.slice(2).trim(" ");
        let spaces = match.length - name.length - 2;
        colorized.push(magenta(match.slice(0, 2)));
        colorized.push(white(" ".repeat(spaces)));
        colorized.push(blue(name));
      },
    },
    {
      pattern: /^-> *\* *[a-z_][a-z_0-9]*/i,
      action: function (match, colorized) {
        let name = match.match(/[a-z_][a-z_0-9]*/)[0];
        let operator = match.match(/-> *\*/)[0];
        let spaces = match.length - name.length - operator.length;
        colorized.push(magenta(operator));
        colorized.push(white(" ".repeat(spaces)));
        colorized.push(blue(name));
      },
    },
    { color: gray, pattern: /^--.*?($|\n)/ },
    { color: green, pattern: /^#[^\[\] \r\n]+/i },
    {
      color: magenta,
      pattern: /^(export|fn|else|if|not|or|and|import|from|as)(?![a-zA-Z_-])/,
    },
    { color: yellow, pattern: /^(true|false)/ },
    { color: green, pattern: /^https?:[^ \r\n]+/ },
    { color: cyan, pattern: /^(->|=>)/ },
    { color: cyan, pattern: /^(!|!=|=|>|<|>=|<=)/ },
    { color: cyan, pattern: /^([\[\]()])/ },
    { color: cyan, pattern: /^[-+/*%^]/ },
    { color: cyan, pattern: /^(([@][a-z][a-z0-9_]*)|[.:@])/i },
    { color: yellow, pattern: /^(0|-?[1-9][0-9']*)(\.[0-9']+)?/ },
    { color: white, pattern: /^[a-z_][a-z_0-9]*('s? )?/i },
    { color: green, pattern: /^('([^\\]|\\.)*?'|:\S+)/ },
    { color: white, pattern: /^\S+/ },
    { color: white, pattern: /^(\r\n|[\r\n])/ },
    { color: white, pattern: /\s+/ },
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
