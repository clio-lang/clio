import { commonPlugins } from "./rollup.common";

export default {
  input: "src/clio/worker.js",
  output: {
    sourcemap: true,
    format: "iife",
    name: "worker",
    file: "public/build/worker.js",
  },
  plugins: commonPlugins(),
};
