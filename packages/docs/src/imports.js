export default function dynamicImport(path) {
  switch (path) {
    case "./meta/v0.9.0.json":
      return import("./meta/v0.9.0.json");
    case "./routes/v0.9.0/index.svelte":
      return import("./routes/v0.9.0/index.svelte");
    case "./routes/v0.9.0/install.svelte":
      return import("./routes/v0.9.0/install.svelte");
    default:
      break;
  }
};
