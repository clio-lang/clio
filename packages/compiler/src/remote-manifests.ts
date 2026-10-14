import { copySchema, type TaskSchema } from "../../protocol/src/schema.js";
import type { RemoteRecordMetadata } from "../../protocol/src/remote-records.js";
import type {
  RemoteCaptureManifest,
  RemoteClientManifest,
  RemoteClientService,
  RemoteDeploymentManifest,
} from "../../protocol/src/remote-contract.js";
import { parseRemoteClientManifest } from "../../protocol/src/remote-contract.js";

/** Portable, deterministic build metadata. Never imports generated application code. */
export async function remoteManifests(
  files: ReadonlyMap<string, { readonly code: string }>,
  services: Readonly<Record<string, RemoteClientService>>,
  records: RemoteRecordMetadata = {},
  captures?: RemoteCaptureManifest,
): Promise<{
  deployment: RemoteDeploymentManifest;
  client: RemoteClientManifest;
}> {
  const compare = (
    [a]: readonly [string, unknown],
    [b]: readonly [string, unknown],
  ) => (a < b ? -1 : a > b ? 1 : 0);
  const ordered = Object.fromEntries(Object.entries(services).sort(compare));
  const content = JSON.stringify([
    "kalandra-remote-build-v1",
    [...files].sort(compare).map(([path, file]) => [path, file.code]),
    ordered,
    records,
    captures,
  ]);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(content),
  );
  const revision = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const client = parseRemoteClientManifest(
    JSON.stringify({ version: 1, revision, services: ordered, ...records }),
  );
  const deployment: RemoteDeploymentManifest = {
    ...(captures ? { captures } : {}),
    version: 1,
    revision,
    services: Object.fromEntries(
      Object.entries(client.services).map(([id, service]) => [
        id,
        {
          module: service.module,
          exportName: service.exportName,
          schemas: service.schemas,
        },
      ]),
    ),
  };
  if (JSON.stringify(deployment).length > 1024 * 1024)
    throw new TypeError("Deployment manifest is too large");
  return { deployment, client };
}

/** Map callbacks receive item, explicit arguments, index, and the source array. */
export function remoteMapSchemas(signature: TaskSchema): TaskSchema[] {
  const first = signature.args[0];
  if (!first) return [];
  const candidates: TaskSchema[] = [
    {
      args: [...signature.args, "number", { array: first }],
      result: signature.result,
    },
  ];
  if (signature.args.length > 1 && signature.args.at(-1) === "number")
    candidates.push({
      args: [...signature.args, { array: first }],
      result: signature.result,
    });
  return candidates.flatMap((schema) => {
    // An optional map form must not invalidate an otherwise bounded service.
    try {
      return [copySchema(schema)];
    } catch {
      return [];
    }
  });
}
