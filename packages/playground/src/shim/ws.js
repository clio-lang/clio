// This is a small WebSocket wrapper to make it
// API compatible with node module ws
class WebSocketWrap {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.listeners = {};
    this.socket.onopen = (event) => this.emit("open", event);
    this.socket.onclose = (event) => this.emit("close", event);
    this.socket.onerror = (event) => this.emit("error", event);
    this.socket.onmessage = async (event) =>
      this.emit("message", await event.data.arrayBuffer());
  }
  send(data) {
    return this.socket.send(data);
  }
  emit(event, ...args) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].forEach((fn) => fn(...args));
    return this;
  }
  on(event, callback) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].push(callback);
    return this;
  }
  off(event, callback) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event] = this.listeners[event].filter(
      (fn) => fn !== callback
    );
    return this;
  }
}

module.exports = WebSocketWrap;
