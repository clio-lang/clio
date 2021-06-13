export default function getRoute(path) {
  switch (path) {
    case "../routes/v0.9.0/index.svelte":
      return import("../routes/v0.9.0/index.svelte");
    case "../routes/v0.9.0/install.svelte":
      return import("../routes/v0.9.0/install.svelte");
    default:
      break;
  }
};
