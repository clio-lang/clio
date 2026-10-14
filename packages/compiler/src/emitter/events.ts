/** Local Clio listener behavior, without host imports or evaluating pattern text. */
export const eventHelpersSource = `(() => {
  const isRegExp = value => Object.prototype.toString.call(value) === "[object RegExp]";
  const patternOf = text => {
    const end = text.lastIndexOf("/");
    return new RegExp(text.slice(1, end), text.slice(end + 1));
  };
  class EventEmitter {
    constructor() {
      this.id = "emitter." + Array.from({ length: 64 }, () => (~~(Math.random() * 36)).toString(36)).join("");
      this.resource = null;
      this.listeners = {};
      this.regexListeners = {};
    }
    emit(event, ...args) {
      this.listeners[event] = this.listeners[event] || [];
      this.listeners[event].forEach(fn => fn(...args));
      for (const [pattern, fns] of Object.entries(this.regexListeners)) {
        if (event.match(patternOf(pattern))) fns.forEach(fn => fn(event, ...args));
      }
      return this;
    }
    emitUnless(callback, event, ...args) {
      this.listeners[event] = this.listeners[event] || [];
      this.listeners[event].filter(fn => fn !== callback).forEach(fn => fn(...args));
      for (const [pattern, fns] of Object.entries(this.regexListeners)) {
        if (event.match(patternOf(pattern))) fns.filter(fn => fn !== callback).forEach(fn => fn(event, ...args));
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
      listeners[event] = listeners[event].filter(fn => fn !== callback);
      return this;
    }
  }
  return { emitter: () => new EventEmitter() };
})()`;
