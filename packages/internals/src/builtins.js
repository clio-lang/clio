const { Fn } = require("./functions");
const { IO } = require("./io");
const { Lazy } = require("./lazy");

const wrapLazy = fn => new Fn(fn, null, Lazy);
const wrapIO = fn => new Fn(fn, null, IO);

const add = wrapLazy((scope, a, b) => a.valueOf() + b.valueOf());
const sub = wrapLazy((scope, a, b) => a.valueOf() - b.valueOf());
const mul = wrapLazy((scope, a, b) => a.valueOf() * b.valueOf());
const div = wrapLazy((scope, a, b) => a.valueOf() / b.valueOf());

const pow = wrapLazy((scope, a, b) => Math.pow(a.valueOf(), b.valueOf()));

const print = wrapIO((scope, ...args) =>
  console.log(...args.map(arg => arg.valueOf()))
).unCurry();

const undistribute = wrapIO((scope, fn) => {
  fn.distributed = false;
  return fn;
});

module.exports = {
  add,
  sub,
  mul,
  div,
  pow,
  undistribute,
  print
};
