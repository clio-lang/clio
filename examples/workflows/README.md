# Complete Kalandra workflows

These new programs test combinations of ported features. They are not evidence of historical Clio compatibility. The Tiramisu guide at `/docs/guide/workflows` renders these exact files and includes commands for running all three projects.

| Project        | Coverage                                                                             | Expected result        |
| -------------- | ------------------------------------------------------------------------------------ | ---------------------- |
| `invoices`     | Local modules, record inheritance, typed JavaScript package                          | `[35.91, 18]`          |
| `local-batch`  | Record mapping, typed captures, nested workers, repeated snapshots                   | `[12, 22, 12, 22, 10]` |
| `remote-batch` | Independent service/client, remote records, local-to-remote mapping, server captures | `[12, 22, 12, 22]`     |

From the repository root:

```sh
(cd examples/workflows/invoices && bun install --offline --ignore-scripts)
bun run cli run examples/workflows/invoices/main.kalandra --strict
bun run cli run examples/workflows/local-batch/main.kalandra --strict
```

For remote setup, follow the guide. Build `remote-batch/service/main.kalandra` with the `calibrate`, `broken`, and `slow` service exports; copy the generated contract to `client/readings.client.json`; use the same `KALANDRA_REMOTE_TOKEN` on server and client; and supply `client/endpoints.json` to the client. The failure and cancellation entrypoints are deliberate test cases, not ordinary batch programs.

`bun run check` checks local workflows through the source and isolated bundled CLI. `bun run test:network` and `bun run test:network --built` check CLI service hosting, mapped results, failure cleanup, SIGINT cancellation after workers start, recovery, and listener shutdown. Network verification requires local sockets and Unix process inspection. Tests run temporary copies and remove them afterward.
