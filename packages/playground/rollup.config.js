import { mainPlugins } from "./rollup.common.js";

export default {
  input: "src/main.js",
  output: {
    sourcemap: true,
    format: "iife",
    name: "app",
    file: "public/build/bundle.js",
  },
  plugins: mainPlugins(),
  watch: {
    clearScreen: false,
  },
};
