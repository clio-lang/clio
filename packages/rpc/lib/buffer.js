import { Buffer as BufferShim } from "buffer/";

export const BufferClass = typeof Buffer === "undefined" ? BufferShim : Buffer;
export { BufferClass as Buffer };
