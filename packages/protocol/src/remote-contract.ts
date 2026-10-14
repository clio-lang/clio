import {
  validateRemoteRecords,
  type RemoteRecordMetadata,
} from "./remote-records.js";
import { schemaKey, type TaskSchema } from "./schema.js";

export interface RemoteServiceManifest {
  readonly module: string;
  readonly exportName: string;
  readonly schemas: readonly string[];
}
export interface RemoteCaptureManifest {
  readonly bootstrap: { readonly module: string; readonly schema: TaskSchema };
  readonly bindings: Readonly<
    Record<
      string,
      { readonly schema: TaskSchema; readonly indices: readonly number[] }
    >
  >;
}
export interface RemoteDeploymentManifest {
  readonly captures?: RemoteCaptureManifest;
  readonly version: 1;
  readonly revision: string;
  readonly services: Readonly<Record<string, RemoteServiceManifest>>;
}
export interface RemoteClientService extends RemoteServiceManifest {
  /** Public export selected from the build entry, including re-exports. */
  readonly source: { readonly module: string; readonly exportName: string };
  /** Declared parameters and fulfilled result; excludes map callback extras. */
  readonly signature: TaskSchema;
  readonly async: boolean;
}
export interface RemoteClientManifest extends RemoteRecordMetadata {
  readonly version: 1;
  readonly revision: string;
  readonly services: Readonly<Record<string, RemoteClientService>>;
}
export const remoteIdentifier = /^[A-Za-z0-9_-]{1,128}$/;
export function isRemoteModulePath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.endsWith(".mjs") &&
    value
      .split("/")
      .every(
        (part) =>
          /^[A-Za-z0-9._~-]+$/.test(part) && part !== "." && part !== "..",
      )
  );
}

/** Parse data only: no service modules are imported or evaluated. */
export function parseRemoteClientManifest(text: string): RemoteClientManifest {
  if (text.length > 1024 * 1024)
    throw new TypeError("Client manifest is too large");
  const input = JSON.parse(text);
  if (
    !input ||
    input.version !== 1 ||
    typeof input.revision !== "string" ||
    !remoteIdentifier.test(input.revision) ||
    !input.services ||
    typeof input.services !== "object" ||
    Array.isArray(input.services)
  )
    throw new TypeError("Invalid client manifest");
  const entries = Object.entries(input.services);
  if (!entries.length || entries.length > 256)
    throw new TypeError("Invalid service count");
  const targets = new Set<string>();
  const services: [string, RemoteClientService][] = [];
  for (const [id, value] of entries) {
    const service = value as RemoteClientService | null;
    if (
      !remoteIdentifier.test(id) ||
      !service ||
      !isRemoteModulePath(service.module) ||
      typeof service.exportName !== "string" ||
      !remoteIdentifier.test(service.exportName) ||
      typeof service.async !== "boolean" ||
      !service.source ||
      typeof service.source.module !== "string" ||
      !service.source.module.endsWith(".kalandra") ||
      typeof service.source.exportName !== "string" ||
      !service.source.exportName.length ||
      !Array.isArray(service.schemas) ||
      !service.schemas.length ||
      service.schemas.length > 256
    )
      throw new TypeError("Invalid client service");
    const key = schemaKey(service.signature);
    const schemas = service.schemas.map((schema) => {
      if (
        typeof schema !== "string" ||
        schema.length > 16384 ||
        schemaKey(JSON.parse(schema)) !== schema
      )
        throw new TypeError("Service schema must be canonical");
      return schema;
    });
    if (!schemas.includes(key))
      throw new TypeError("Service signature is not registered");
    const target = service.module + "#" + service.exportName;
    if (targets.has(target)) throw new TypeError("Duplicate client route");
    targets.add(target);
    services.push([
      id,
      {
        module: service.module,
        exportName: service.exportName,
        schemas,
        source: {
          module: service.source.module,
          exportName: service.source.exportName,
        },
        signature: JSON.parse(key) as TaskSchema,
        async: service.async,
      },
    ]);
  }
  return {
    version: 1,
    revision: input.revision,
    services: Object.fromEntries(services),
    ...validateRemoteRecords(
      input,
      services.flatMap(([, service]) =>
        service.schemas.map((key) => JSON.parse(key) as TaskSchema),
      ),
      services.map(([name]) => name),
    ),
  };
}

/** Stable virtual task identity; it contains no endpoint, credential or server path. */
export function remoteTaskModule(contract: string, service: string): string {
  return `kalandra-remote:${encodeURIComponent(contract)}/${encodeURIComponent(service)}`;
}
export interface RemoteImportManifest {
  readonly version: 1;
  readonly contracts: Readonly<Record<string, RemoteClientManifest>>;
}
export function parseRemoteImportManifest(text: string): RemoteImportManifest {
  if (text.length > 1024 * 1024)
    throw new TypeError("Remote import manifest is too large");
  const input = JSON.parse(text);
  if (
    !input ||
    input.version !== 1 ||
    !input.contracts ||
    typeof input.contracts !== "object" ||
    Array.isArray(input.contracts)
  )
    throw new TypeError("Invalid remote import manifest");
  const contracts = Object.entries(input.contracts);
  if (!contracts.length || contracts.length > 256)
    throw new TypeError("Invalid remote contract count");
  return {
    version: 1,
    contracts: Object.fromEntries(
      contracts.map(([path, contract]) => {
        if (
          !path.endsWith(".json") ||
          /[:\\\0]/.test(path) ||
          path.split("/").some((part) => !part || part === "." || part === "..")
        )
          throw new TypeError("Invalid remote contract path");
        return [path, parseRemoteClientManifest(JSON.stringify(contract))];
      }),
    ),
  };
}
