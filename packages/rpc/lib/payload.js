class Packet {
  constructor(source, destination, payload) {
    this.source = source;
    this.payload = payload;
    this.destination = destination;
  }
}

class Payload {
  constructor(id, type, data) {
    this.id = id;
    this.type = type;
    this.data = data;
  }
}

module.exports.Packet = Packet;
module.exports.Payload = Payload;
