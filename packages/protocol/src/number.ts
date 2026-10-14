import { Sia } from "@timeleap/sia";

/** Kalandra Number: exactly eight little-endian IEEE-754 binary64 bytes. */
export function writeNumber(sia: Sia, value: number): void {
  if (typeof value !== "number") throw new TypeError("Expected a Number");
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setFloat64(0, value, true);
  sia.addByteArrayN(bytes);
}

export function readNumber(sia: Sia): number {
  const bytes = sia.readByteArrayN(8);
  return new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).getFloat64(0, true);
}
