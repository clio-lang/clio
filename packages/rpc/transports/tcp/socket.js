const { EventEmitter } = require("../../common");
const { Buffer } = require("../../lib");

const header = Buffer.alloc(2);

class TCPSocket extends EventEmitter {
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

module.exports.TCPSocket = TCPSocket;
