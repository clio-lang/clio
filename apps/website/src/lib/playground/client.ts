export type PlaygroundEvent =
  | { kind: "loading" | "compiling" | "running" | "stopped" | "invalid" }
  | { kind: "output" | "result" | "error"; text: string }
  | {
      kind: "diagnostics";
      diagnostics: {
        code: string;
        severity: string;
        message: string;
        span?: { start: number };
      }[];
    };

let assets: Promise<string[]> | undefined;
function loadAssets() {
  return (assets ??= Promise.all(
    ["sandbox", "compiler", "worker"].map(async (name) => {
      const response = await fetch(`/playground/${name}.js`);
      if (!response.ok)
        throw new Error("Playground assets could not be loaded. Please retry.");
      return response.text();
    }),
  ).catch((error) => {
    assets = undefined;
    throw error;
  }));
}

/** A fresh opaque frame and workers per run; the docs page never executes source. */
export function startPlayground(
  source: string,
  receive: (event: PlaygroundEvent) => void,
) {
  let stopped = false;
  let frame: HTMLIFrameElement | undefined;
  let port: MessagePort | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let fallback: ReturnType<typeof setTimeout> | undefined;
  let readyListener: ((event: MessageEvent) => void) | undefined;
  const destroy = () => {
    if (deadline) clearTimeout(deadline);
    if (fallback) clearTimeout(fallback);
    if (readyListener) window.removeEventListener("message", readyListener);
    port?.close();
    frame?.remove();
  };
  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (deadline) clearTimeout(deadline);
    receive({ kind: "stopped" });
    if (port) {
      port.postMessage({ kind: "stop" });
      // A responsive supervisor acknowledges cleanup. Removing the frame also
      // discards its owned workers if the supervisor fails to respond.
      fallback = setTimeout(destroy, 250);
    } else destroy();
  };
  receive({ kind: "loading" });
  deadline = setTimeout(() => {
    if (!stopped) {
      receive({
        kind: "output",
        text: "Stopped after the 10-second run limit.",
      });
      stop();
    }
  }, 10_000);
  void loadAssets()
    .then(([sandbox, compilerWorker, taskWorker]) => {
      if (stopped) return;
      frame = document.createElement("iframe");
      frame.hidden = true;
      frame.title = "Isolated Kalandra execution";
      frame.setAttribute("sandbox", "allow-scripts");
      const token = crypto.randomUUID();
      const nonce = crypto.randomUUID();
      readyListener = (event) => {
        if (
          event.source !== frame?.contentWindow ||
          event.data?.kalandraReady !== token ||
          stopped
        )
          return;
        window.removeEventListener("message", readyListener!);
        const channel = new MessageChannel();
        port = channel.port1;
        port.onmessage = ({ data }) => {
          if (stopped) {
            destroy();
            return;
          }
          receive(data as PlaygroundEvent);
          if (["result", "error", "invalid", "stopped"].includes(data?.kind)) {
            stopped = true;
            destroy();
          }
        };
        frame.contentWindow!.postMessage({ kind: "connect" }, "*", [
          channel.port2,
        ]);
        receive({ kind: "compiling" });
        port.postMessage({ kind: "start", source, compilerWorker, taskWorker });
      };
      window.addEventListener("message", readyListener);
      const policy = `default-src 'none'; script-src 'nonce-${nonce}' 'unsafe-eval' blob:; worker-src blob:; connect-src 'none'; img-src 'none'; style-src 'none'; base-uri 'none'; form-action 'none'`;
      frame.srcdoc = `<!doctype html><meta http-equiv="Content-Security-Policy" content="${policy}"><script type="module" nonce="${nonce}">globalThis.__kalandraToken=${JSON.stringify(token)};\n${sandbox!.replace(/<\/script/gi, "<\\/script")}<\/script>`;
      document.body.append(frame);
    })
    .catch((error) => {
      if (stopped) return;
      stopped = true;
      receive({
        kind: "error",
        text: error instanceof Error ? error.message : String(error),
      });
      destroy();
    });
  return { stop };
}
