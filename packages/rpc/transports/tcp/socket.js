import { Buffer } from "../../lib.js";
import { EventEmitter } from "../../common.js";

const header = Buffer.alloc(2);

export class TCPSocket extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
  }
  send(data) {
    header.writeUInt16LE(data.length, 0);
    this.socket.write(Buffer.from(header));
    this.socket.write(data);
  }
}
