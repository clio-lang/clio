export { EventEmitter } from "clio-lang-internals";

export function randomId() {
  return Math.floor(Math.random() * 0xffffffff);
}
