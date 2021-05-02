const { AsyncResource } = require("async_hooks");
const randomId = require("./random");

const isRegExp = (o) => Object.prototype.toString.call(o) === "[object RegExp]";

class EventEmitter {
  constructor(id) {
    // TODO: this needs to be improved
    this.id = id || "emitter." + randomId(64);
    this.resource = AsyncResource ? new AsyncResource(this.id) : null;
    this.listeners = {};
    this.regexListeners = {};
  }
  emit(event, ...args) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].forEach((fn) => fn(...args));
    for (const [pattern, fns] of Object.entries(this.regexListeners)) {
      const regex = eval(pattern);
      if (event.match(regex)) fns.forEach((fn) => fn(event, ...args));
    }
    return this;
  }
  emitUnless(callback, event, ...args) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event]
      .filter((fn) => fn !== callback)
      .forEach((fn) => fn(...args));
    for (const [pattern, fns] of Object.entries(this.regexListeners)) {
      const regex = eval(pattern);
      if (event.match(regex))
        fns.filter((fn) => fn !== callback).forEach((fn) => fn(event, ...args));
    }
    return this;
  }
  on(event, callback) {
    const listeners = isRegExp(event) ? this.regexListeners : this.listeners;
    listeners[event] = listeners[event] || [];
    listeners[event].push(callback);
    return this;
  }
  off(event, callback) {
    const listeners = isRegExp(event) ? this.regexListeners : this.listeners;
    listeners[event] = listeners[event] || [];
    listeners[event] = listeners[event].filter((fn) => fn !== callback);
    return this;
  }
}

module.exports.EventEmitter = EventEmitter;
module.exports.emitter = () => new EventEmitter();
