const { EventEmitter } = require("../../common");

class WebSocketShim extends EventEmitter {
  constructor(...args) {
    super();
    this.socket = new WebSocket(...args);
    this.socket.onopen = (ev) => this.emit("open", ev);
    this.socket.onclose = (ev) => this.emit("close", ev);
    this.socket.onerror = (ev) => this.emit("error", ev);
    this.socket.onmessage = (ev) => this.emit("message", ev.data);
  }
  send(...args) {
    this.socket.send(...args);
  }
}

module.exports = WebSocketShim;
