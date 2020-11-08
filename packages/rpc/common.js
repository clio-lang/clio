const randomId = (n) =>
  [...Array(n)].map((i) => (~~(Math.random() * 36)).toString(36)).join("");

class EventEmitter {
  constructor() {
    this.listeners = {};
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

module.exports.randomId = randomId;
module.exports.EventEmitter = EventEmitter;
