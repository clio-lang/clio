class Emitter {
  constructor() {
    this.listeners = new Map();
  }
  on(event, callback) {
    const listeners = this.listeners.get(event) || [];
    listeners.push(callback);
    this.listeners.set(event, listeners);
    return this;
  }
  emit(event, ...data) {
    const listeners = this.listeners.get(event) || [];
    for (const callback of listeners) {
      callback.call(this, event, ...data);
    }
    return this;
  }
}

module.exports = Emitter;
