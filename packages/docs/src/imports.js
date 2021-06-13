export default function dynamicImport(path) {
  switch (path) {
    case "./meta/v0.9.0.json":
      return import("./meta/v0.9.0.json");
    case "./meta/v0.9.0.js":
      return import("./meta/v0.9.0.js");
    default:
      break;
  }
};
