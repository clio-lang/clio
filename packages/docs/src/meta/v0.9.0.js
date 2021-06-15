export default function getRoute(path) {
  switch (path) {
    case "../routes/v0.9.0/start/index.svelte":
      return import("../routes/v0.9.0/start/index.svelte");
    case "../routes/v0.9.0/start/install.svelte":
      return import("../routes/v0.9.0/start/install.svelte");
    case "../routes/v0.9.0/tutorial/index.svelte":
      return import("../routes/v0.9.0/tutorial/index.svelte");
    case "../routes/v0.9.0/tutorial/intro.svelte":
      return import("../routes/v0.9.0/tutorial/intro.svelte");
    default:
      break;
  }
};
