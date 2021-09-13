const { EventEmitter } = require("../common");

class PacketParser extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.size = 0;
    this.data = Buffer.alloc(0);
    this.socket.on("data", (data) => {
      if (this.size) {
        this.data = Buffer.concat([this.data, data]);
      } else {
        this.size = data.readUInt16LE();
        this.data = data.slice(2);
      }
      while (this.size && this.data.length >= this.size) {
        const packet = Buffer.from(this.data.slice(0, this.size));
        if (this.data.length > this.size) {
          const remaining = this.data.slice(this.size + 2);
          this.size = this.data.readUInt16LE(this.size);
          this.data = remaining;
        } else {
          this.size = 0;
          this.data = Buffer.alloc(0);
        }
        this.emit("message", packet);
      }
    });
  }
}

module.exports.PacketParser = PacketParser;
