import alias from "@rollup/plugin-alias";
import commonjs from "@rollup/plugin-commonjs";
import css from "rollup-plugin-css-only";
import json from "@rollup/plugin-json";
import livereload from "rollup-plugin-livereload";
import nodePolyfills from "rollup-plugin-polyfill-node";
import path from "path";
import resolve from "@rollup/plugin-node-resolve";
import { spawn } from "child_process";
import svelte from "rollup-plugin-svelte";
import { terser } from "rollup-plugin-terser";

const production = !process.env.ROLLUP_WATCH;

function serve() {
  let server;

  function toExit() {
    if (server) server.kill(0);
  }

  return {
    writeBundle() {
      if (server) return;
      server = spawn("npm", ["run", "start", "--", "--dev"], {
        stdio: ["ignore", "inherit", "inherit"],
        shell: true,
      });

      process.on("SIGTERM", toExit);
      process.on("exit", toExit);
    },
  };
}

export default {
  input: "src/main.js",
  output: {
    sourcemap: true,
    format: "iife",
    name: "app",
    file: "public/build/bundle.js",
  },
  plugins: [
    svelte({
      compilerOptions: {
        // enable run-time checks when not in production
        dev: !production,
      },
    }),
    // we'll extract any component CSS out into
    // a separate file - better for performance
    css({ output: "bundle.css" }),
    alias({
      entries: [
        {
          find: "async_hooks",
          replacement: path.join(__dirname, "src/shim/async_hooks.js"),
        },
      ],
    }),

    commonjs(),
    nodePolyfills({ include: null }),
    // If you have external dependencies installed from
    // npm, you'll most likely need these plugins. In
    // some cases you'll need additional configuration -
    // consult the documentation for details:
    // https://github.com/rollup/plugins/tree/master/packages/commonjs
    resolve({
      browser: true,
      dedupe: ["svelte"],
    }),

    json(),

    // In dev mode, call `npm run start` once
    // the bundle has been generated
    !production && serve(),

    // Watch the `public` directory and refresh the
    // browser on changes when not in production
    !production && livereload("public"),

    // If we're building for production (npm run build
    // instead of npm run dev), minify
    production && terser(),
  ],
  watch: {
    clearScreen: false,
  },
};
