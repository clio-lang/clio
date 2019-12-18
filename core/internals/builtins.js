const { Fn } = require("./functions");
const { Lazy, IO } = require("./lazy");

const wrapLazy = fn => new Fn((scope, ...args) => fn(...args), null, Lazy);
const wrapIO = fn => new Fn((scope, ...args) => fn(...args), null, IO);

const add = wrapLazy((a, b) => a.valueOf() + b.valueOf());
const sub = wrapLazy((a, b) => a.valueOf() - b.valueOf());
const mul = wrapLazy((a, b) => a.valueOf() * b.valueOf());
const div = wrapLazy((a, b) => a.valueOf() / b.valueOf());

const pow = wrapLazy((a, b) => Math.pow(a.valueOf(), b.valueOf()));

const print = wrapIO((...args) =>
  console.log(...args.map(arg => arg.valueOf()))
);

module.exports = {
  add,
  sub,
  mul,
  div,
  pow,
  print
};
