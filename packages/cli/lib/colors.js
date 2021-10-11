import chalk from "chalk";

const { blue, green, yellow } = chalk;

export const brightRed = chalk.rgb(255, 80, 50);

export function trace(e) {
  return console.trace(brightRed(`Error: ${e.message}`));
}

export function error(e, prefix = "") {
  let message = `Error: ${e.message || e}`;
  if (prefix) message = `${prefix} `.concat(message);
  console.error(brightRed(message));
  process.exit(4);
}

export function warn(message) {
  return console.warn(yellow(`Warning: ${message}`));
}

export function info(message) {
  return console.log(blue(`Info: ${message}`));
}

export function success(message) {
  return console.log(green(`Success: ${message}`));
}
