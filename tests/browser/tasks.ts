import {
  schemaKey,
  type TaskSchema,
} from "../../packages/protocol/src/index.js";
const number: TaskSchema = { args: ["number"], result: "number" };
const noArgs: TaskSchema = { args: [], result: "number" };
export const __kalandraSchemas = {
  echo: [schemaKey(number)],
  text: [schemaKey({ args: ["string"], result: "string" })],
  identify: [schemaKey({ args: ["number"], result: "string" })],
  delay: [schemaKey({ args: ["number", "number"], result: "number" })],
  spin: [schemaKey(noArgs)],
  fail: [schemaKey(noArgs)],
  invalid: [schemaKey(noArgs)],
  crash: [schemaKey(noArgs)],
};
export const echo = (n: number) => n;
export const text = (value: string) => value;
const identity = crypto.randomUUID();
export async function identify(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
  return identity;
}
export async function delay(n: number, ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
  return n;
}
export function spin() {
  void fetch(new URL("./started", import.meta.url));
  while (true) {
    /* Deliberately uncooperative task for hard cancellation. */
  }
}
export function fail() {
  throw new TypeError("browser task broke");
}
export function invalid() {
  return "wrong result type";
}
export async function crash() {
  setTimeout(() => {
    throw new Error("worker crashed");
  }, 0);
  await new Promise(() => {});
}
