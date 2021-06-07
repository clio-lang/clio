(function () {
  'use strict';

  var global = (typeof global !== "undefined" ? global :
    typeof self !== "undefined" ? self :
    typeof window !== "undefined" ? window : {});

  // shim for using process in browser
  // based off https://github.com/defunctzombie/node-process/blob/master/browser.js

  function defaultSetTimout() {
      throw new Error('setTimeout has not been defined');
  }
  function defaultClearTimeout () {
      throw new Error('clearTimeout has not been defined');
  }
  var cachedSetTimeout = defaultSetTimout;
  var cachedClearTimeout = defaultClearTimeout;
  if (typeof global.setTimeout === 'function') {
      cachedSetTimeout = setTimeout;
  }
  if (typeof global.clearTimeout === 'function') {
      cachedClearTimeout = clearTimeout;
  }

  function runTimeout(fun) {
      if (cachedSetTimeout === setTimeout) {
          //normal enviroments in sane situations
          return setTimeout(fun, 0);
      }
      // if setTimeout wasn't available but was latter defined
      if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
          cachedSetTimeout = setTimeout;
          return setTimeout(fun, 0);
      }
      try {
          // when when somebody has screwed with setTimeout but no I.E. maddness
          return cachedSetTimeout(fun, 0);
      } catch(e){
          try {
              // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
              return cachedSetTimeout.call(null, fun, 0);
          } catch(e){
              // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
              return cachedSetTimeout.call(this, fun, 0);
          }
      }


  }
  function runClearTimeout(marker) {
      if (cachedClearTimeout === clearTimeout) {
          //normal enviroments in sane situations
          return clearTimeout(marker);
      }
      // if clearTimeout wasn't available but was latter defined
      if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
          cachedClearTimeout = clearTimeout;
          return clearTimeout(marker);
      }
      try {
          // when when somebody has screwed with setTimeout but no I.E. maddness
          return cachedClearTimeout(marker);
      } catch (e){
          try {
              // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
              return cachedClearTimeout.call(null, marker);
          } catch (e){
              // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
              // Some versions of I.E. have different rules for clearTimeout vs setTimeout
              return cachedClearTimeout.call(this, marker);
          }
      }



  }
  var queue = [];
  var draining = false;
  var currentQueue;
  var queueIndex = -1;

  function cleanUpNextTick() {
      if (!draining || !currentQueue) {
          return;
      }
      draining = false;
      if (currentQueue.length) {
          queue = currentQueue.concat(queue);
      } else {
          queueIndex = -1;
      }
      if (queue.length) {
          drainQueue();
      }
  }

  function drainQueue() {
      if (draining) {
          return;
      }
      var timeout = runTimeout(cleanUpNextTick);
      draining = true;

      var len = queue.length;
      while(len) {
          currentQueue = queue;
          queue = [];
          while (++queueIndex < len) {
              if (currentQueue) {
                  currentQueue[queueIndex].run();
              }
          }
          queueIndex = -1;
          len = queue.length;
      }
      currentQueue = null;
      draining = false;
      runClearTimeout(timeout);
  }
  function nextTick(fun) {
      var args = new Array(arguments.length - 1);
      if (arguments.length > 1) {
          for (var i = 1; i < arguments.length; i++) {
              args[i - 1] = arguments[i];
          }
      }
      queue.push(new Item(fun, args));
      if (queue.length === 1 && !draining) {
          runTimeout(drainQueue);
      }
  }
  // v8 likes predictible objects
  function Item(fun, array) {
      this.fun = fun;
      this.array = array;
  }
  Item.prototype.run = function () {
      this.fun.apply(null, this.array);
  };
  var title = 'browser';
  var platform = 'browser';
  var browser$1 = true;
  var env = {};
  var argv = [];
  var version = ''; // empty string to avoid regexp issues
  var versions = {};
  var release = {};
  var config = {};

  function noop() {}

  var on = noop;
  var addListener = noop;
  var once = noop;
  var off = noop;
  var removeListener = noop;
  var removeAllListeners = noop;
  var emit = noop;

  function binding(name) {
      throw new Error('process.binding is not supported');
  }

  function cwd () { return '/' }
  function chdir (dir) {
      throw new Error('process.chdir is not supported');
  }function umask() { return 0; }

  // from https://github.com/kumavis/browser-process-hrtime/blob/master/index.js
  var performance = global.performance || {};
  var performanceNow =
    performance.now        ||
    performance.mozNow     ||
    performance.msNow      ||
    performance.oNow       ||
    performance.webkitNow  ||
    function(){ return (new Date()).getTime() };

  // generate timestamp or delta
  // see http://nodejs.org/api/process.html#process_process_hrtime
  function hrtime(previousTimestamp){
    var clocktime = performanceNow.call(performance)*1e-3;
    var seconds = Math.floor(clocktime);
    var nanoseconds = Math.floor((clocktime%1)*1e9);
    if (previousTimestamp) {
      seconds = seconds - previousTimestamp[0];
      nanoseconds = nanoseconds - previousTimestamp[1];
      if (nanoseconds<0) {
        seconds--;
        nanoseconds += 1e9;
      }
    }
    return [seconds,nanoseconds]
  }

  var startTime = new Date();
  function uptime() {
    var currentTime = new Date();
    var dif = currentTime - startTime;
    return dif / 1000;
  }

  var browser$1$1 = {
    nextTick: nextTick,
    title: title,
    browser: browser$1,
    env: env,
    argv: argv,
    version: version,
    versions: versions,
    on: on,
    addListener: addListener,
    once: once,
    off: off,
    removeListener: removeListener,
    removeAllListeners: removeAllListeners,
    emit: emit,
    binding: binding,
    cwd: cwd,
    chdir: chdir,
    umask: umask,
    hrtime: hrtime,
    platform: platform,
    release: release,
    config: config,
    uptime: uptime
  };

  function getAugmentedNamespace(n) {
  	if (n.__esModule) return n;
  	var a = Object.defineProperty({}, '__esModule', {value: true});
  	Object.keys(n).forEach(function (k) {
  		var d = Object.getOwnPropertyDescriptor(n, k);
  		Object.defineProperty(a, k, d.get ? d : {
  			enumerable: true,
  			get: function () {
  				return n[k];
  			}
  		});
  	});
  	return a;
  }

  var async_hooks = /*#__PURE__*/Object.freeze({
    __proto__: null
  });

  var require$$0$1 = /*@__PURE__*/getAugmentedNamespace(async_hooks);

  var src$1 = {};

  var emitter$1 = {};

  const randomId$4 = (n) =>
    [...Array(n)].map((i) => (~~(Math.random() * 36)).toString(36)).join("");

  var random = randomId$4;

  const { AsyncResource } = require$$0$1;
  const randomId$3 = random;

  const isRegExp = (o) => Object.prototype.toString.call(o) === "[object RegExp]";

  class EventEmitter$g {
    constructor(id) {
      // TODO: this needs to be improved
      this.id = id || "emitter." + randomId$3(64);
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

  emitter$1.EventEmitter = EventEmitter$g;
  emitter$1.emitter = () => new EventEmitter$g();

  const parseCloudLocation = (location) => {
    const [_, protocol, host, path] = location.match(
      /([a-z]+):\/\/([^\/]+)\/(.*)/
    );
    return { protocol, host, path };
  };

  const supported = ["tcp", "ipc", "ws"];

  const remote = async (clio, location) => {
    const { protocol, host, path } = parseCloudLocation(location);
    if (!supported.includes(protocol))
      throw new Error(`Protocol "${protocol}" is not supported.`);
    const executor = await clio.distributed.getExecutor(protocol, host);
    const paths = await executor.getFunctions(path);
    const fns = {};
    for (const key in paths) fns[key.slice(path.length + 1)] = paths[key];
    return fns;
  };

  var remote_1 = remote;

  class it {
    constructor(fn, firstIndex = 0, lastIndex = Infinity) {
      this.firstIndex = firstIndex;
      this.lastIndex = lastIndex;
      this.index = 0;
      this.fn = fn;
    }
    next() {
      const value = this.fn(this.firstIndex + this.index++);
      const done = this.lastIndex < this.firstIndex + this.index;
      if (done) this.index = this.firstIndex;
      return { value, done };
    }
    map(fn) {
      const currFn = this.fn;
      this.fn = (index) => fn(currFn(this.firstIndex + index), index, this);
      return this;
    }
    take(n) {
      return new it(this.fn, this.firstIndex, this.firstIndex + n);
    }
    skip(n) {
      return new it(this.fn, this.firstIndex + n, this.lastIndex);
    }
    slice(start, end) {
      return this.skip(this.firstIndex + start).take(end - start);
    }
    toArray() {
      return [...this];
    }
    [Symbol.iterator]() {
      return this;
    }
  }

  var iterator = it;

  var range$1 = {};

  class Range$1 {
    constructor(start = 0, end = Infinity, step, mapfn) {
      this.start = start;
      this.end = end;
      this.step = step || (end > start ? 1 : -1);
      this.mapfn = mapfn;
      this.index = 0;
    }
    get length() {
      return Math.floor((this.start - this.end) / this.step);
    }
    map(fn) {
      const mapfn = this.mapfn
        ? (item, index, range) => fn(this.mapfn(item, index, range), index, range)
        : fn;
      return new Range$1(this.start, this.end, this.step, mapfn);
    }
    get(index) {
      const value = this.start + this.step * index;
      if (value > this.end) return undefined; // JS arrays do the same
      return this.mapfn ? this.mapfn(value, index, this) : value;
    }
    take(n) {
      return new Range$1(
        this.start,
        this.start + n * this.step - this.step,
        this.step,
        this.mapfn
      );
    }
    skip(n) {
      return new Range$1(
        this.start + n * this.step,
        this.end,
        this.step,
        this.mapfn
      );
    }
    slice(start, end) {
      return this.skip(start).take(end - start);
    }
    toArray() {
      return [...this];
    }
    toString() {
      return `[${this.start}:${this.end}:${this.step}]`;
    }
    next() {
      const value = this.start + this.step * this.index;
      const done = value >= this.end;
      const mapped = this.mapfn ? this.mapfn(value, this.index, this) : value;
      if (done) this.index = 0;
      else this.index++;
      return { value: mapped, done };
    }
    [Symbol.iterator]() {
      return this;
    }
  }

  const range = (start, end, step) => new Range$1(start, end, step);

  range$1.range = range;
  range$1.Range = Range$1;

  const { Range } = range$1;

  const getIndex = (item, index) => {
    const isRange = item instanceof Range;
    index = index >= 0 ? index : item.length - index;
    return isRange ? item.get(index) : item[index];
  };

  const numberSlice = (item, number) => getIndex(item, number);

  const rangeSlice = (item, range) => {
    const result = [];
    for (const index of range) {
      if (index > item.length) return result;
      result.push(getIndex(item, index));
    }
    return result;
  };

  const arraySlice = (arr, slicers) => {
    return slicers.map((slicer, index) => {
      if (isNumber(slicer)) return getIndex(arr, slicer);
      else return slice(arr[index], slicer);
    });
  };

  const checkType = (o) =>
    Object.prototype.toString
      .call(o)
      .replace(/\[|object\s|\]/g, "")
      .toLowerCase();

  const isNumber = (o) => checkType(o) === "number";
  const isRange = (o) => o instanceof Range;

  const slice = (arr, slicers) => {
    if (isRange(slicers)) return rangeSlice(arr, slicers);
    if (slicers.length === 1 && isNumber(slicers[0]))
      return numberSlice(arr, slicers[0]);
    return arraySlice(arr, slicers);
  };

  var slice_1 = slice;

  var doc = (fn) => console.log(fn.__doc__);

  var format = (...args) => args.map((arg) => arg.toString()).join("");

  const { EventEmitter: EventEmitter$f, emitter } = emitter$1;

  src$1.remote = remote_1;
  src$1.iterator = iterator;
  src$1.range = range$1.range;
  src$1.randomId = random;
  src$1.slice = slice_1;
  src$1.doc = doc;
  src$1.f = format;
  src$1.EventEmitter = EventEmitter$f;
  src$1.emitter = emitter;

  var executor$1 = {};

  var common = {};

  const { randomId: randomId$2, EventEmitter: EventEmitter$e } = src$1;

  common.randomId = randomId$2;
  common.EventEmitter = EventEmitter$e;

  const { randomId: randomId$1, EventEmitter: EventEmitter$d } = common;

  class Executor$3 {
    constructor(transport) {
      this.transport = transport;
      this.isConnected = false;
      this.connect();
      this.promises = new Map();
      this.emitters = new Map();
      this.id = "executor." + randomId$1(64);
    }
    connect() {
      this.transport.on("message", (data) => this.handleData(data));
      this.transport.on("connect", () => this.onConnect());
      this.transport.connect();
    }
    onConnect() {
      this.isConnected = true;
    }
    deserialize(data) {
      const reviver = (_, value) => {
        if (value && value["@type"] == "EventEmitter") {
          const { id, clientId } = value;
          if (this.emitters.has(id)) return this.emitters.get(id);
          const emitter = new EventEmitter$d(id);
          const send = (event, ...args) => {
            this.transport.send({
              instruction: "event",
              details: JSON.stringify({ id, event, args }),
              toClient: clientId,
            });
          };
          emitter.on(/.*/, send);
          this.emitters.set(id, { emitter, send });
          return emitter;
        }
        return value;
      };
      return JSON.parse(data, reviver);
    }
    handleData(data) {
      const { id, details, instruction, toClient } = data;
      // TODO: there must be a better way to do this
      if (toClient !== this.id) return;
      const deserialized = this.deserialize(details);
      if (instruction == "result") {
        const { result } = deserialized;
        return this.promises.get(id).resolve(result);
      } else if (instruction == "event") {
        const { id, event, args } = deserialized;
        const { emitter, send } = this.emitters.get(id);
        emitter.emitUnless(send, event, ...args);
      } else if (instruction == "paths") {
        const { paths } = deserialized;
        return this.promises.get(id).resolve(paths);
      }
    }
    call(path, args) {
      const id = randomId$1(64);
      const promise = new Promise((resolve) => {
        this.promises.set(id, { resolve });
      });
      const send = () =>
        this.transport.send({
          instruction: "call",
          details: JSON.stringify({ path, args }),
          clientId: this.id,
          path,
          id,
        });
      if (this.isConnected) send();
      else this.transport.on("connect", send);
      return promise;
    }
    getFunction(path) {
      return (...args) => this.call(path, args);
    }
    async getFunctions(path) {
      const id = randomId$1(64);
      const promise = new Promise((resolve) => {
        this.promises.set(id, { resolve });
      });
      const send = () =>
        this.transport.send({
          instruction: "getPaths",
          details: JSON.stringify({ path }),
          clientId: this.id,
          id,
        });
      if (this.isConnected) send();
      else this.transport.on("connect", send);
      const paths = await promise;
      const fns = {};
      for (const path of paths) fns[path] = this.getFunction(path);
      return fns;
    }
  }

  var Executor_1 = executor$1.Executor = Executor$3;

  var ws$1 = {};

  var server$3 = {};

  var browser = function () {
    throw new Error(
      'ws does not work in the browser. Browser clients must use the native ' +
        'WebSocket object'
    );
  };

  var socket$3 = {};

  const { EventEmitter: EventEmitter$c } = common;

  class WSSocket$1 extends EventEmitter$c {
    constructor(socket) {
      super();
      this.socket = socket;
      this.socket.on("message", (data) => this.onData(data));
    }
    send(data) {
      this.socket.send(JSON.stringify(data));
    }
    onData(data) {
      const deserialized = JSON.parse(data);
      this.emit("message", deserialized);
    }
  }

  socket$3.WSSocket = WSSocket$1;

  const WebSocket$1 = browser;
  const { WSSocket } = socket$3;
  const { EventEmitter: EventEmitter$b } = common;

  class Server$a extends EventEmitter$b {
    constructor(config) {
      super();
      this.wsConfig = config || Server$a.defaultWSConfig();
      this.ready = false;
    }
    static defaultWSConfig() {
      return { port: 8080, url: "ws://localhost:8080" };
    }
    createWSServer() {
      if (!this.wsConfig) return;
      const { port } = this.wsConfig;
      this.wsServer = new WebSocket$1.Server({ port });
      this.wsServer.on("listening", () => this.onListening());
      this.wsServer.on("connection", (socket) => this.onWSConnect(socket));
    }
    onListening() {
      this.ready = true;
      this.emit("listening");
    }
    onWSConnect(socket) {
      const wsSocket = new WSSocket(socket);
      socket.on("message", (data) => this.handleIncoming(wsSocket, data));
    }
    handleIncoming(socket, data) {
      this.emit("message", socket, data);
    }
    start() {
      return this.createWSServer();
    }
  }

  server$3.Server = Server$a;

  var client$3 = {};

  const WebSocket = browser;
  const { Server: Server$9 } = server$3;
  const { EventEmitter: EventEmitter$a } = common;

  class Client$7 extends EventEmitter$a {
    constructor(config) {
      super();
      this.wsConfig = config || Server$9.defaultWSConfig();
    }
    connect() {
      const { url } = this.wsConfig;
      this.socket = new WebSocket(url);
      this.socket.on("open", () => this.emit("connect"));
      this.socket.on("error", (error) => this.emit("error", error));
      this.socket.on("message", (data) => this.onData(data));
    }
    send(data) {
      this.socket.send(JSON.stringify(data));
    }
    onData(data) {
      const deserialized = JSON.parse(data);
      this.emit("message", deserialized);
    }
  }

  client$3.Client = Client$7;

  const { Server: Server$8 } = server$3;
  const { Client: Client$6 } = client$3;

  ws$1.Server = Server$8;
  ws$1.Client = Client$6;

  const { Executor: Executor$2 } = executor$1;
  const WS = ws$1;

  var ws = async function (key, protocol, host) {
    const transport = new WS.Client({ url: `${protocol}://${host}` });
    transport.connect();
    await new Promise((resolve) => transport.on("connect", resolve));
    const executor = new Executor$2(transport);
    this.executors.set(key, executor);
    return executor;
  };

  var ipc$1 = {};

  var server$2 = {};

  var _polyfillNode_readline = {};

  var _polyfillNode_readline$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    'default': _polyfillNode_readline
  });

  var require$$0 = /*@__PURE__*/getAugmentedNamespace(_polyfillNode_readline$1);

  var _polyfillNode_net = {};

  var _polyfillNode_net$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    'default': _polyfillNode_net
  });

  var require$$1 = /*@__PURE__*/getAugmentedNamespace(_polyfillNode_net$1);

  // Copyright Joyent, Inc. and other Node contributors.
  //
  // Permission is hereby granted, free of charge, to any person obtaining a
  // copy of this software and associated documentation files (the
  // "Software"), to deal in the Software without restriction, including
  // without limitation the rights to use, copy, modify, merge, publish,
  // distribute, sublicense, and/or sell copies of the Software, and to permit
  // persons to whom the Software is furnished to do so, subject to the
  // following conditions:
  //
  // The above copyright notice and this permission notice shall be included
  // in all copies or substantial portions of the Software.
  //
  // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
  // OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
  // MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
  // NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
  // DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
  // OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
  // USE OR OTHER DEALINGS IN THE SOFTWARE.

  // resolves . and .. elements in a path array with directory names there
  // must be no slashes, empty elements, or device names (c:\) in the array
  // (so also no leading and trailing slashes - it does not distinguish
  // relative and absolute paths)
  function normalizeArray(parts, allowAboveRoot) {
    // if the path tries to go above the root, `up` ends up > 0
    var up = 0;
    for (var i = parts.length - 1; i >= 0; i--) {
      var last = parts[i];
      if (last === '.') {
        parts.splice(i, 1);
      } else if (last === '..') {
        parts.splice(i, 1);
        up++;
      } else if (up) {
        parts.splice(i, 1);
        up--;
      }
    }

    // if the path is allowed to go above the root, restore leading ..s
    if (allowAboveRoot) {
      for (; up--; up) {
        parts.unshift('..');
      }
    }

    return parts;
  }

  // Split a filename into [root, dir, basename, ext], unix version
  // 'root' is just a slash, or nothing.
  var splitPathRe =
      /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
  var splitPath = function(filename) {
    return splitPathRe.exec(filename).slice(1);
  };

  // path.resolve([from ...], to)
  // posix version
  function resolve() {
    var resolvedPath = '',
        resolvedAbsolute = false;

    for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
      var path = (i >= 0) ? arguments[i] : '/';

      // Skip empty and invalid entries
      if (typeof path !== 'string') {
        throw new TypeError('Arguments to path.resolve must be strings');
      } else if (!path) {
        continue;
      }

      resolvedPath = path + '/' + resolvedPath;
      resolvedAbsolute = path.charAt(0) === '/';
    }

    // At this point the path should be resolved to a full absolute path, but
    // handle relative paths to be safe (might happen when process.cwd() fails)

    // Normalize the path
    resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
      return !!p;
    }), !resolvedAbsolute).join('/');

    return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
  }
  // path.normalize(path)
  // posix version
  function normalize(path) {
    var isPathAbsolute = isAbsolute(path),
        trailingSlash = substr(path, -1) === '/';

    // Normalize the path
    path = normalizeArray(filter(path.split('/'), function(p) {
      return !!p;
    }), !isPathAbsolute).join('/');

    if (!path && !isPathAbsolute) {
      path = '.';
    }
    if (path && trailingSlash) {
      path += '/';
    }

    return (isPathAbsolute ? '/' : '') + path;
  }
  // posix version
  function isAbsolute(path) {
    return path.charAt(0) === '/';
  }

  // posix version
  function join() {
    var paths = Array.prototype.slice.call(arguments, 0);
    return normalize(filter(paths, function(p, index) {
      if (typeof p !== 'string') {
        throw new TypeError('Arguments to path.join must be strings');
      }
      return p;
    }).join('/'));
  }


  // path.relative(from, to)
  // posix version
  function relative(from, to) {
    from = resolve(from).substr(1);
    to = resolve(to).substr(1);

    function trim(arr) {
      var start = 0;
      for (; start < arr.length; start++) {
        if (arr[start] !== '') break;
      }

      var end = arr.length - 1;
      for (; end >= 0; end--) {
        if (arr[end] !== '') break;
      }

      if (start > end) return [];
      return arr.slice(start, end - start + 1);
    }

    var fromParts = trim(from.split('/'));
    var toParts = trim(to.split('/'));

    var length = Math.min(fromParts.length, toParts.length);
    var samePartsLength = length;
    for (var i = 0; i < length; i++) {
      if (fromParts[i] !== toParts[i]) {
        samePartsLength = i;
        break;
      }
    }

    var outputParts = [];
    for (var i = samePartsLength; i < fromParts.length; i++) {
      outputParts.push('..');
    }

    outputParts = outputParts.concat(toParts.slice(samePartsLength));

    return outputParts.join('/');
  }

  var sep = '/';
  var delimiter = ':';

  function dirname(path) {
    var result = splitPath(path),
        root = result[0],
        dir = result[1];

    if (!root && !dir) {
      // No dirname whatsoever
      return '.';
    }

    if (dir) {
      // It has a dirname, strip trailing slash
      dir = dir.substr(0, dir.length - 1);
    }

    return root + dir;
  }

  function basename(path, ext) {
    var f = splitPath(path)[2];
    // TODO: make this comparison case-insensitive on windows?
    if (ext && f.substr(-1 * ext.length) === ext) {
      f = f.substr(0, f.length - ext.length);
    }
    return f;
  }


  function extname(path) {
    return splitPath(path)[3];
  }
  var _polyfillNode_path = {
    extname: extname,
    basename: basename,
    dirname: dirname,
    sep: sep,
    delimiter: delimiter,
    relative: relative,
    join: join,
    isAbsolute: isAbsolute,
    normalize: normalize,
    resolve: resolve
  };
  function filter (xs, f) {
      if (xs.filter) return xs.filter(f);
      var res = [];
      for (var i = 0; i < xs.length; i++) {
          if (f(xs[i], i, xs)) res.push(xs[i]);
      }
      return res;
  }

  // String.prototype.substr - negative index don't work in IE8
  var substr = 'ab'.substr(-1) === 'b' ?
      function (str, start, len) { return str.substr(start, len) } :
      function (str, start, len) {
          if (start < 0) start = str.length + start;
          return str.substr(start, len);
      }
  ;

  var _polyfillNode_path$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    resolve: resolve,
    normalize: normalize,
    isAbsolute: isAbsolute,
    join: join,
    relative: relative,
    sep: sep,
    delimiter: delimiter,
    dirname: dirname,
    basename: basename,
    extname: extname,
    'default': _polyfillNode_path
  });

  var require$$8 = /*@__PURE__*/getAugmentedNamespace(_polyfillNode_path$1);

  var socket$2 = {};

  const readline$5 = require$$0;
  const { EventEmitter: EventEmitter$9 } = common;

  class IPCSocket$1 extends EventEmitter$9 {
    constructor(socket) {
      super();
      this.socket = socket;
      this.socket.rl = readline$5.createInterface(this.socket);
      this.socket.rl.on("line", (data) => this.onData(data));
      this.socket.on("close", () => this.socket.rl.close());
    }
    send(data) {
      this.socket.write(JSON.stringify(data) + "\n");
    }
    onData(data) {
      const deserialized = JSON.parse(data);
      this.emit("message", deserialized);
    }
  }

  socket$2.IPCSocket = IPCSocket$1;

  const readline$4 = require$$0;
  const net$3 = require$$1;
  const path = require$$8;
  const { IPCSocket } = socket$2;
  const { EventEmitter: EventEmitter$8 } = common;

  class Server$7 extends EventEmitter$8 {
    constructor(config) {
      super();
      this.ipcConfig = config || Server$7.defaultIPCConfig();
      this.ready = false;
    }
    static getIPCPath({ name }) {
      const parts = [browser$1$1?.cwd() || ".", name];
      if (browser$1$1?.platform == "win32") parts.unshift("\\\\?\\pipe");
      return path.join(...parts);
    }
    static defaultIPCConfig() {
      return {
        path: Server$7.getIPCPath({ name: "ipc.sock" }),
      };
    }
    createIPCServer() {
      if (!this.ipcConfig) return;
      const { path } = this.ipcConfig;
      this.ipcServer = net$3.createServer();
      this.ipcServer.on("listening", () => this.onListening());
      this.ipcServer.listen(path);
      this.ipcServer.on("connection", (socket) => this.onIPCConnect(socket));
    }
    onListening() {
      this.ready = true;
      this.emit("listening");
    }
    onIPCConnect(socket) {
      socket.rl = readline$4.createInterface(socket);
      socket.rl.on("line", (data) => this.handleIncoming(socket, data));
      socket.on("close", () => socket.rl.close());
    }
    handleIncoming(socket, data) {
      const ipcSocket = new IPCSocket(socket);
      this.emit("message", ipcSocket, data);
    }
    start() {
      return this.createIPCServer();
    }
  }

  server$2.Server = Server$7;

  var client$2 = {};

  const readline$3 = require$$0;
  const net$2 = require$$1;
  const { Server: Server$6 } = server$2;
  const { EventEmitter: EventEmitter$7 } = common;

  class Client$5 extends EventEmitter$7 {
    constructor(config) {
      super();
      this.ipcConfig = config || Server$6.defaultIPCConfig();
    }
    connect() {
      this.socket = net$2.connect(this.ipcConfig.path);
      this.rl = readline$3.createInterface(this.socket);
      this.rl.on("line", (data) => this.onData(data));
      this.socket.on("connect", () => this.emit("connect"));
      this.socket.on("error", (error) => this.emit("error", error));
      this.socket.on("close", () => this.rl.close());
    }
    send(data) {
      this.socket.write(JSON.stringify(data) + "\n");
    }
    onData(data) {
      const deserialized = JSON.parse(data);
      this.emit("message", deserialized);
    }
  }

  client$2.Client = Client$5;

  const { Server: Server$5 } = server$2;
  const { Client: Client$4 } = client$2;

  ipc$1.Server = Server$5;
  ipc$1.Client = Client$4;

  const { Executor: Executor$1 } = executor$1;
  const IPC = ipc$1;

  var ipc = async function (key, _, path) {
    const transport = new IPC.Client({ path });
    transport.connect();
    await new Promise((resolve) => transport.on("connect", resolve));
    const executor = new Executor$1(transport);
    this.executors.set(key, executor);
    return executor;
  };

  var tcp$1 = {};

  var server$1 = {};

  var socket$1 = {};

  const readline$2 = require$$0;
  const { EventEmitter: EventEmitter$6 } = common;

  class TCPSocket$1 extends EventEmitter$6 {
    constructor(socket) {
      super();
      this.socket = socket;
      this.socket.rl = readline$2.createInterface(this.socket);
      this.socket.rl.on("line", (data) => this.onData(data));
      this.socket.on("close", () => this.socket.rl.close());
    }
    send(data) {
      this.socket.write(JSON.stringify(data) + "\n");
    }
    onData(data) {
      const deserialized = JSON.parse(data);
      this.emit("message", deserialized);
    }
  }

  socket$1.TCPSocket = TCPSocket$1;

  const readline$1 = require$$0;
  const net$1 = require$$1;
  const { TCPSocket } = socket$1;
  const { EventEmitter: EventEmitter$5 } = common;

  class Server$4 extends EventEmitter$5 {
    constructor(config) {
      super();
      this.tcpConfig = config || Server$4.defaultTCPConfig();
      this.ready = false;
    }
    static defaultTCPConfig() {
      return { port: 4444, host: "0.0.0.0" };
    }
    createTCPServer() {
      if (!this.tcpConfig) return;
      const { port, host } = this.tcpConfig;
      this.tcpServer = net$1.createServer();
      this.tcpServer.on("listening", () => this.onListening());
      this.tcpServer.listen(port, host);
      this.tcpServer.on("connection", (socket) => this.onTCPConnect(socket));
    }
    onListening() {
      this.ready = true;
      this.emit("listening");
    }
    onTCPConnect(socket) {
      socket.rl = readline$1.createInterface(socket);
      socket.rl.on("line", (data) => this.handleIncoming(socket, data));
      socket.on("close", () => socket.rl.close());
    }
    handleIncoming(socket, data) {
      const tcpSocket = new TCPSocket(socket);
      this.emit("message", tcpSocket, data);
    }
    start() {
      return this.createTCPServer();
    }
  }

  server$1.Server = Server$4;

  var client$1 = {};

  const readline = require$$0;
  const net = require$$1;
  const { Server: Server$3 } = server$1;
  const { EventEmitter: EventEmitter$4 } = common;

  class Client$3 extends EventEmitter$4 {
    constructor(config) {
      super();
      this.tcpConfig = config || Server$3.defaultTCPConfig();
    }
    connect() {
      const { port, host } = this.tcpConfig;
      this.socket = net.connect(port, host);
      this.rl = readline.createInterface(this.socket);
      this.rl.on("line", (data) => this.onData(data));
      this.socket.on("connect", () => this.emit("connect"));
      this.socket.on("error", (error) => this.emit("error", error));
      this.socket.on("close", () => this.rl.close());
    }
    send(data) {
      this.socket.write(JSON.stringify(data) + "\n");
    }
    onData(data) {
      const deserialized = JSON.parse(data);
      this.emit("message", deserialized);
    }
  }

  client$1.Client = Client$3;

  const { Server: Server$2 } = server$1;
  const { Client: Client$2 } = client$1;

  tcp$1.Server = Server$2;
  tcp$1.Client = Client$2;

  const { Executor } = executor$1;
  const TCP = tcp$1;

  var tcp = async function (key, _, addr) {
    const [host, port] = addr.split(":");
    const transport = new TCP.Client({ host, port });
    transport.connect();
    await new Promise((resolve) => transport.on("connect", resolve));
    const executor = new Executor(transport);
    this.executors.set(key, executor);
    return executor;
  };

  const builtins = src$1;

  const executors = {
    ws: ws,
    ipc: ipc,
    tcp: tcp,
  };

  class Distributed {
    constructor(isWorker, connection) {
      this.map = new Map();
      this.isWorker = isWorker;
      this.connection = connection;
      this.executors = new Map();
    }
    set(key, fn) {
      this.map.set(key, fn);
      if (this.isWorker) this.connection.register(key, fn);
    }
    get(key) {
      return this.connection.getFunction(key);
    }
    async getExecutor(protocol, host) {
      const key = `${protocol}:${host}`;
      if (this.executors.has(key)) return this.executors.get(key);
      return await executors[protocol].call(this, key, protocol, host);
    }
  }

  const workerDist = (executor, worker) =>
    new Distributed(true, {
      register(path, fn) {
        return worker.register({ path, fn });
      },
      getFunction(fn) {
        return executor.getFunction(fn);
      },
      getFunctions(path) {
        return executor.getFunctions(path);
      },
    });

  const mainDist = (executor) =>
    new Distributed(false, {
      getFunction(fn) {
        return executor.getFunction(fn);
      },
      getFunctions(path) {
        return executor.getFunctions(path);
      },
    });

  const run = async (module, { worker, executor }, { noMain = false } = {}) => {
    const clio = {
      distributed: worker ? workerDist(executor, worker) : mainDist(executor),
      isWorker: !!worker,
      isMain: !worker,
      exports: {},
      ...builtins,
    };
    clio.register = (name, fn) => {
      clio.distributed.set(name, fn);
      fn.parallel = clio.distributed.get(name);
      return fn;
    };
    const { main } = await module.exports(clio);
    const argv = browser$1$1?.argv || [];
    if (!worker && !noMain) {
      const result = await main(argv);
      const awaited = Array.isArray(result)
        ? await Promise.all(result)
        : await result;
      return awaited;
    }
  };

  var run_1 = run;

  const { randomId, EventEmitter: EventEmitter$3 } = common;

  class Worker {
    constructor(transport) {
      this.transport = transport;
      this.transport.on("message", (data) => this.handleData(data));
      this.transport.on("connect", () => this.handleConnect());
      this.transport.on("error", (error) => this.onError(error));
      this.functions = new Map();
      this.emitters = new Map();
      this.retries = 10;
      this.id = "worker." + randomId(64);
    }
    register({ path, fn }) {
      this.functions.set(path, fn);
    }
    getFn(path) {
      return this.functions.get(path);
    }
    connect() {
      this.transport.connect();
    }
    onError(error) {
      const { code } = error;
      if (code == "ECONNREFUSED") {
        if (!this.retries)
          throw new Error("Out of retries, cannot connect to the server.");
        this.retries--;
        setTimeout(() => this.connect(), 100);
      }
    }
    handleConnect() {
      this.retries = 10;
      const id = randomId(64);
      const paths = [...this.functions.keys()];
      this.send(
        {
          instruction: "registerWorker",
          details: JSON.stringify({ paths }),
        },
        id
      );
    }
    handleData(data) {
      const { instruction, details, id, clientId, toClient } = data;
      // TODO: there must be a better way to do this
      if (toClient !== this.id) return;
      if (instruction == "call")
        this.handleCallInstruction(details, id, clientId);
      else if (instruction == "event")
        this.handleEventInstruction(details, id, clientId);
    }
    async handleCallInstruction(details, id, clientId) {
      const { path, args } = JSON.parse(details);
      const fn = this.getFn(path);
      const result = await fn(...args);
      this.sendResult(result, id, clientId);
    }
    async handleEventInstruction(details, id, clientId) {
      const { id: emitterId, event, args } = JSON.parse(details);
      const { emitter, send } = this.emitters.get(emitterId);
      emitter.emitUnless(send, event, ...args);
    }
    serialize(data, clientId) {
      const replacer = (_, value) => {
        if (value instanceof EventEmitter$3) {
          const { id } = value;
          const send = (event, ...args) => {
            const data = {
              instruction: "event",
              details: this.serialize({ id, event, args }),
              toClient: clientId,
            };
            this.send(data);
          };
          value.on(/.*/, send);
          this.emitters.set(id, { emitter: value, send });
          // TODO: kill the emitter on client close
          return { "@type": "EventEmitter", clientId: this.id, id };
        }
        return value;
      };
      return JSON.stringify(data, replacer);
    }
    async sendResult(result, id, clientId) {
      result = await result;
      const data = {
        instruction: "result",
        details: this.serialize({ result }, clientId),
        toClient: clientId,
      };
      this.send(data, id);
    }
    send(data, id) {
      this.transport.send({ ...data, clientId: this.id, id });
    }
  }

  var Worker_1 = Worker;

  var webWorker = {};

  var server = {};

  var socket = {};

  const { EventEmitter: EventEmitter$2 } = common;

  class WebWorkerSocket$1 extends EventEmitter$2 {
    constructor(worker) {
      super();
      this.worker = worker;
      this.messageIds = new Set();
      this.connect();
    }
    connect() {
      this.worker.on("message", (data) =>
        this.handleWorkerMessage(JSON.parse(data))
      );
      this.emit("connect");
    }
    handleWorkerMessage(data) {
      const { id } = data;
      if (this.messageIds.delete(id)) this.emit("message", data);
    }
    send(data) {
      const { id } = data;
      this.messageIds.add(id);
      this.worker.postMessage(JSON.stringify(data));
    }
  }

  socket.WebWorkerSocket = WebWorkerSocket$1;

  const { WebWorkerSocket } = socket;
  const { EventEmitter: EventEmitter$1 } = common;

  class WrappedWebWorker extends EventEmitter$1 {
    constructor(worker) {
      super();
      this.worker = worker;
      this.worker.onmessage = (event) => this.emit("message", event.data);
    }
    postMessage(message) {
      this.worker.postMessage(message);
    }
  }

  class inSocket {
    constructor(socket) {
      this.socket = socket;
    }
    send(data) {
      this.socket.emit("message", data);
    }
  }

  class Socket extends EventEmitter$1 {
    constructor(server) {
      super();
      this.server = server;
      this.inSocket = new inSocket(this);
    }
    connect() {
      this.emit("connect");
    }
    send(data) {
      this.server.handleIncoming(this.inSocket, JSON.stringify(data));
    }
  }

  class Server$1 extends EventEmitter$1 {
    constructor() {
      super();
      this.workers = [];
      this.ready = false;
    }
    start() {
      this.emit("listening");
      this.ready = true;
    }
    addWorker(worker) {
      const wrappedWorker = new WrappedWebWorker(worker);
      const socket = new WebWorkerSocket(wrappedWorker);
      this.workers.push(wrappedWorker);
      wrappedWorker.on("message", (data) => this.handleIncoming(socket, data));
    }
    getTransport() {
      return new Socket(this);
    }
    handleIncoming(socket, data) {
      this.emit("message", socket, data);
    }
  }

  server.Server = Server$1;

  var client = {};

  const { EventEmitter } = common;

  class Client$1 extends EventEmitter {
    constructor({ postMessage }) {
      super();
      this.postMessage = postMessage;
    }
    connect() {
      this.emit("connect");
    }
    onmessage(event) {
      const { data } = event;
      this.emit("message", JSON.parse(data));
    }
    send(data) {
      this.postMessage(JSON.stringify(data));
    }
  }

  client.Client = Client$1;

  const { Server } = server;
  const { Client } = client;

  webWorker.Server = Server;
  webWorker.Client = Client;

  const getModule = async (src) => {
    const module = { exports: {} };
    eval(src);
    return module.exports;
  };

  const location = new URL(self.location);
  const encoded = location.searchParams.get("src");
  const src = decodeURIComponent(encoded).replace(/~~mod~~/g, "%");

  const transport = new webWorker.Client({
    postMessage(data) {
      postMessage(data);
    },
  });

  const worker = new Worker_1(transport);
  const executor = new Executor_1(transport);

  onmessage = (message) => transport.onmessage(message);

  getModule(src)
    .then((main) => {
      run_1(main, { worker, executor });
    })
    .then(() => worker.connect());

}());
//# sourceMappingURL=worker.js.map
