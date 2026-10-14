import { createWorkerHandler } from "../../src/worker-handler.js";

// The adapter uses the worker name for its immutable nesting limit.
const scope = globalThis as unknown as {
  name: string;
  postMessage(message: unknown): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent) => void,
  ): void;
  addEventListener(type: "messageerror", listener: () => void): void;
};
if (!/^kalandra:\d+$/.test(scope.name))
  throw new Error("The runtime worker requires a Kalandra parent");
const fatal = (error: unknown) => {
  // An uncaught error event reaches the parent, which retires the entire task tree.
  setTimeout(() => {
    throw error;
  }, 0);
};
const receive = createWorkerHandler({
  maxChildren: Number(scope.name.slice("kalandra:".length)),
  send: (message) => scope.postMessage(message),
  fatal,
  moduleUrl(value) {
    const url = new URL(value);
    if (!["http:", "https:", "blob:"].includes(url.protocol))
      throw new Error(
        "Browser worker tasks require an absolute HTTP(S) or blob URL",
      );
    return url.href;
  },
});
scope.addEventListener("message", (event) => {
  void receive(event.data).catch(fatal);
});
scope.addEventListener("messageerror", () =>
  fatal(new Error("Browser task message could not be decoded")),
);
