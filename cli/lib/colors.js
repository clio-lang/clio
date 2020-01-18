const chalk = require("chalk");

const brightRed = chalk.rgb(255, 80, 50);

exports.brightRed = brightRed;

exports.trace = e => console.trace(brightRed(`Error: ${e.message}`));

exports.error = (e, prefix = "") => {
  let message = `Error: ${e.message}`;
  if (prefix) message = `${prefix} `.concat(message);
  console.error(brightRed(message));
};

exports.warn = message => console.warn(chalk.yellow(`Warning: ${message}`));

exports.info = message => console.log(chalk.blue(`Info: ${message}`));

exports.success = message => console.log(chalk.green(`Success: ${message}`));
