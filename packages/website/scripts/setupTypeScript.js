// @ts-check

/** This script modifies the project to support TS code in .svelte files like:

  <script lang="ts">
  	export let name: string;
  </script>
 
  As well as validating the code for CI.
  */

/**  To work on this script:
  rm -rf test-template template && git clone sveltejs/template test-template && node scripts/setupTypeScript.js test-template
*/

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "fs";

import { argv } from "process";
import { join } from "path";

const projectRoot = argv[2] || join(__dirname, "..");

// Add deps to pkg.json
const packageJSON = JSON.parse(
  readFileSync(join(projectRoot, "package.json"), "utf8")
);
packageJSON.devDependencies = Object.assign(packageJSON.devDependencies, {
  "svelte-check": "^1.0.0",
  "svelte-preprocess": "^4.0.0",
  "@rollup/plugin-typescript": "^6.0.0",
  typescript: "^3.9.3",
  tslib: "^2.0.0",
  "@tsconfig/svelte": "^1.0.0",
});

// Add script for checking
packageJSON.scripts = Object.assign(packageJSON.scripts, {
  validate: "svelte-check",
});

// Write the package JSON
writeFileSync(
  join(projectRoot, "package.json"),
  JSON.stringify(packageJSON, null, "  ")
);

// mv src/main.js to main.ts - note, we need to edit rollup.config.js for this too
const beforeMainJSPath = join(projectRoot, "src", "main.js");
const afterMainTSPath = join(projectRoot, "src", "main.ts");
renameSync(beforeMainJSPath, afterMainTSPath);

// Switch the app.svelte file to use TS
const appSveltePath = join(projectRoot, "src", "App.svelte");
let appFile = readFileSync(appSveltePath, "utf8");
appFile = appFile.replace("<script>", '<script lang="ts">');
appFile = appFile.replace("export let name;", "export let name: string;");
writeFileSync(appSveltePath, appFile);

// Edit rollup config
const rollupConfigPath = join(projectRoot, "rollup.config.js");
let rollupConfig = readFileSync(rollupConfigPath, "utf8");

// Edit imports
rollupConfig = rollupConfig.replace(
  `'rollup-plugin-terser';`,
  `'rollup-plugin-terser';
import sveltePreprocess from 'svelte-preprocess';
import typescript from '@rollup/plugin-typescript';`
);

// Replace name of entry point
rollupConfig = rollupConfig.replace(`'src/main.js'`, `'src/main.ts'`);

// Add preprocess to the svelte config, this is tricky because there's no easy signifier.
// Instead we look for `css:` then the next `}` and add the preprocessor to that
let foundCSS = false;
let match;

// https://regex101.com/r/OtNjwo/1
const configEditor = new RegExp(/css:.|\n*}/gim);
while ((match = configEditor.exec(rollupConfig)) != null) {
  if (foundCSS) {
    const endOfCSSIndex = match.index + 1;
    rollupConfig =
      rollupConfig.slice(0, endOfCSSIndex) +
      ",\n			preprocess: sveltePreprocess()," +
      rollupConfig.slice(endOfCSSIndex);
    break;
  }
  if (match[0].includes("css:")) foundCSS = true;
}

// Add TypeScript
rollupConfig = rollupConfig.replace(
  "commonjs(),",
  "commonjs(),\n\t\ttypescript({\n\t\t\tsourceMap: !production,\n\t\t\tinlineSources: !production\n\t\t}),"
);
writeFileSync(rollupConfigPath, rollupConfig);

// Add TSConfig
const tsconfig = `{
  "extends": "@tsconfig/svelte/tsconfig.json",

  "include": ["src/**/*"],
  "exclude": ["node_modules/*", "__sapper__/*", "public/*"]
}`;
const tsconfigPath = join(projectRoot, "tsconfig.json");
writeFileSync(tsconfigPath, tsconfig);

// Delete this script, but not during testing
if (!argv[2]) {
  // Remove the script
  unlinkSync(join(__filename));

  // Check for Mac's DS_store file, and if it's the only one left remove it
  const remainingFiles = readdirSync(join(__dirname));
  if (remainingFiles.length === 1 && remainingFiles[0] === ".DS_store") {
    unlinkSync(join(__dirname, ".DS_store"));
  }

  // Check if the scripts folder is empty
  if (readdirSync(join(__dirname)).length === 0) {
    // Remove the scripts folder
    rmdirSync(join(__dirname));
  }
}

// Adds the extension recommendation
mkdirSync(join(projectRoot, ".vscode"));
writeFileSync(
  join(projectRoot, ".vscode", "extensions.json"),
  `{
  "recommendations": ["svelte.svelte-vscode"]
}
`
);

console.log("Converted to TypeScript.");

if (existsSync(join(projectRoot, "node_modules"))) {
  console.log(
    "\nYou will need to re-run your dependency manager to get started."
  );
}
