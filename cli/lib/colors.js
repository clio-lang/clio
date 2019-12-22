const chalk = require("chalk");

exports.error = e => console.log(chalk.red(`Error: ${e.message}`));

exports.warn = message => console.log(chalk.yellow(`Warning: ${message}`));

exports.info = message => console.log(chalk.blue(`Info: ${message}`));

exports.success = message => console.log(chalk.green(`Success: ${message}`));
