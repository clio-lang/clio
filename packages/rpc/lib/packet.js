import { EventEmitter } from "../common.js";

export class PacketParser extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.size = 0;
    this.data = null;
    this.socket.on("data", (data) => {
      this.data = this.data ? Buffer.concat([this.data, data]) : data;
      if (this.size === 0 && this.data.length >= 2) {
        this.size = this.data.readUInt16LE();
        this.data = this.data.slice(2);
      }
      while (this.size && this.data.length >= this.size) {
        const packet = this.data.slice(0, this.size);
        this.emit("message", packet);
        if (this.data.length >= this.size + 2) {
          const size = this.data.readUInt16LE(this.size);
          this.data = this.data.slice(this.size + 2);
          this.size = size;
        } else {
          this.data = this.data.slice(this.size);
          this.size = 0;
        }
      }
    });
  }
}
