export interface MessageTransport {
  send(message: Uint8Array): Promise<void>;
  close(): Promise<void>;
}
export { readNumber, writeNumber } from "./number.js";
export {
  schemaKey,
  copySchema,
  type TaskSchema,
  type WireType,
} from "./schema.js";
export {
  frameHeader,
  validateArguments,
  encodeCall,
  decodeCall,
  encodeReply,
  decodeReply,
  wireVersion,
  type CallFrame,
  type ReplyFrame,
  type CodecLimits,
} from "./frames.js";

export {
  parseRemoteClientManifest,
  type RemoteClientManifest,
  type RemoteClientService,
  type RemoteDeploymentManifest,
  type RemoteCaptureManifest,
  type RemoteServiceManifest,
} from "./remote-contract.js";

export {
  parseRemoteImportManifest,
  remoteTaskModule,
  type RemoteImportManifest,
} from "./remote-contract.js";

export type {
  RemoteRecordDeclaration,
  RemoteRecordMetadata,
} from "./remote-records.js";
