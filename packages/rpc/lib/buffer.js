import { Buffer as BufferShim } from "buffer/index.js";

export const BufferClass = typeof Buffer === "undefined" ? BufferShim : Buffer;
export { BufferClass as Buffer };
