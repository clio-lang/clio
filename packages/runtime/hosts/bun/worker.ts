import { createWorkerHandler } from "../../src/worker-handler.js";

if (!process.send) throw new Error("The runtime worker requires an IPC parent");
const receive = createWorkerHandler({
  maxChildren: Number(process.argv[2] ?? 256),
  allowUntyped: true,
  send: (message) => process.send!(message),
  fatal: () => {
    process.exit(1);
  },
  moduleUrl(value) {
    const url = new URL(value);
    if (url.protocol !== "file:")
      throw new Error("Bun worker tasks require a file URL");
    return url.href;
  },
});
process.on("message", receive);
