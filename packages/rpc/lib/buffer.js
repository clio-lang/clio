import { Buffer as BufferShim } from "buffer/";

export const Buffer = typeof Buffer === "undefined" ? BufferShim : Buffer;
