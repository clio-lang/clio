import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
const [module, workload, nArg, batchArg, seedArg, warmArg, sampleArg] =
  process.argv.slice(2);
const { fib, recurrence, dot } = await import(
  pathToFileURL(resolve(module)).href
);
const [n, batch, seed, warm, samples] = [
  nArg,
  batchArg,
  seedArg,
  warmArg,
  sampleArg,
].map(Number);
const a = Array.from({ length: n }, (_, i) => (i % 97) / 97);
const b = Array.from({ length: n }, (_, i) => ((i % 89) + 1) / 89);
function run() {
  let result = 0;
  for (let j = 0; j < batch; j++) {
    if (workload === "fib") result += fib(n + (j % 3));
    else if (workload === "recurrence") result += recurrence(n, seed + j);
    else {
      a[0] = seed + j;
      result += dot(a, b, 0, 0);
    }
  }
  return result;
}
let result = 0;
for (let i = 0; i < warm; i++) result = run();
const times = [];
const checksums = [];
for (let i = 0; i < samples; i++) {
  const start = performance.now();
  result = run();
  times.push(performance.now() - start);
  checksums.push(result);
}
console.log(JSON.stringify({ times, checksums }));
