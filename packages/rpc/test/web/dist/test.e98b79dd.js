// modules are defined as an array
// [ module function, map of requires ]
//
// map of requires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the require for previous bundles
parcelRequire = (function (modules, cache, entry, globalName) {
  // Save the require from previous bundle to this closure if any
  var previousRequire = typeof parcelRequire === 'function' && parcelRequire;
  var nodeRequire = typeof require === 'function' && require;

  function newRequire(name, jumped) {
    if (!cache[name]) {
      if (!modules[name]) {
        // if we cannot find the module within our internal map or
        // cache jump to the current global require ie. the last bundle
        // that was added to the page.
        var currentRequire = typeof parcelRequire === 'function' && parcelRequire;
        if (!jumped && currentRequire) {
          return currentRequire(name, true);
        }

        // If there are other bundles on this page the require from the
        // previous one is saved to 'previousRequire'. Repeat this as
        // many times as there are bundles until the module is found or
        // we exhaust the require chain.
        if (previousRequire) {
          return previousRequire(name, true);
        }

        // Try the node require function if it exists.
        if (nodeRequire && typeof name === 'string') {
          return nodeRequire(name);
        }

        var err = new Error('Cannot find module \'' + name + '\'');
        err.code = 'MODULE_NOT_FOUND';
        throw err;
      }

      localRequire.resolve = resolve;
      localRequire.cache = {};

      var module = cache[name] = new newRequire.Module(name);

      modules[name][0].call(module.exports, localRequire, module, module.exports, this);
    }

    return cache[name].exports;

    function localRequire(x){
      return newRequire(localRequire.resolve(x));
    }

    function resolve(x){
      return modules[name][1][x] || x;
    }
  }

  function Module(moduleName) {
    this.id = moduleName;
    this.bundle = newRequire;
    this.exports = {};
  }

  newRequire.isParcelRequire = true;
  newRequire.Module = Module;
  newRequire.modules = modules;
  newRequire.cache = cache;
  newRequire.parent = previousRequire;
  newRequire.register = function (id, exports) {
    modules[id] = [function (require, module) {
      module.exports = exports;
    }, {}];
  };

  var error;
  for (var i = 0; i < entry.length; i++) {
    try {
      newRequire(entry[i]);
    } catch (e) {
      // Save first error but execute all entries
      if (!error) {
        error = e;
      }
    }
  }

  if (entry.length) {
    // Expose entry point to Node, AMD or browser globals
    // Based on https://github.com/ForbesLindesay/umd/blob/master/template.js
    var mainExports = newRequire(entry[entry.length - 1]);

    // CommonJS
    if (typeof exports === "object" && typeof module !== "undefined") {
      module.exports = mainExports;

    // RequireJS
    } else if (typeof define === "function" && define.amd) {
     define(function () {
       return mainExports;
     });

    // <script>
    } else if (globalName) {
      this[globalName] = mainExports;
    }
  }

  // Override the current require with this new one
  parcelRequire = newRequire;

  if (error) {
    // throw error from earlier, _after updating parcelRequire_
    throw error;
  }

  return newRequire;
})({"../../common.js":[function(require,module,exports) {
const randomId = n => [...Array(n)].map(i => (~~(Math.random() * 36)).toString(36)).join("");

class EventEmitter {
  constructor() {
    this.listeners = {};
  }

  emit(event, ...args) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].forEach(fn => fn(...args));
  }

  on(event, callback) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].push(callback);
    return this;
  }

  off(event, callback) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event] = this.listeners[event].filter(fn => fn !== callback);
    return this;
  }

}

module.exports.randomId = randomId;
module.exports.EventEmitter = EventEmitter;
},{}],"../../dispatcher.js":[function(require,module,exports) {
const {
  EventEmitter
} = require("./common");

class Dispatcher extends EventEmitter {
  constructor() {
    super();
    this.workers = new Map();
    this.sockets = new Map();
    this.jobs = new Map();
    this.connectedWorkers = [];
    this.transports = [];
  }

  addTransport(transport) {
    this.transports.push(transport);
    transport.on("call", (...args) => this.call(...args));
    transport.on("registerWorker", (...args) => this.registerWorker(...args));
    transport.start();
  }

  call(socket, {
    path,
    args
  }, id) {
    const worker = this.getWorker(path);

    if (worker) {
      this.sockets.set(id, socket);
      this.send(worker, {
        instruction: "call",
        details: {
          path,
          args
        }
      }, id);
    } else {
      this.addJob(socket, {
        path,
        args
      }, id);
    }
  }

  registerWorker(worker, {
    paths
  }, id) {
    for (const path of paths) this.workers.set(path, [...(this.workers.get(path) || []), worker]);

    worker.on("message", data => this.handleWorkerResponse(data));

    for (const path of paths) {
      const jobs = this.jobs.get(path) || [];
      this.jobs.set(path, []);

      for (const job of jobs) this.call(...job);
    }

    this.connectedWorkers.push(worker);
    const listeners = this.listeners.workerConnected || [];
    listeners.forEach(fn => fn.call(this, worker));
  }

  addJob(socket, {
    path,
    args
  }, id) {
    this.jobs.set(path, [...(this.jobs.get(path) || []), [socket, {
      path,
      args
    }, id]]);
  }

  handleWorkerResponse(data) {
    const {
      instruction,
      details,
      id
    } = data;
    const socket = this.sockets.get(id);
    this.send(socket, {
      instruction,
      details
    }, id);
  }

  getWorker(path) {
    const workers = this.workers.get(path);
    if (!workers) return;
    const {
      length
    } = workers;
    const index = Math.floor(Math.random() * length);
    return workers[index];
  }

  send(socket, data, id) {
    socket.send({ ...data,
      id
    });
  }

  expectWorkers(n) {
    return new Promise(resolve => {
      if (this.connectedWorkers.length >= n) resolve();

      const waitForN = () => {
        const {
          length
        } = this.connectedWorkers;

        if (length >= n) {
          this.off("workerConnected", waitForN);
          resolve();
        }
      };

      this.on("workerConnected", waitForN);
    });
  }

}

module.exports.Dispatcher = Dispatcher;
},{"./common":"../../common.js"}],"../../executor.js":[function(require,module,exports) {
const {
  randomId
} = require("./common");

class Executor {
  constructor(transport) {
    this.transport = transport;
    this.isConnected = false;
    this.connect();
    this.promises = new Map();
  }

  connect() {
    this.transport.on("message", data => this.handleData(data));
    this.transport.on("connect", () => this.onConnect());
    this.transport.connect();
  }

  onConnect() {
    this.isConnected = true;
  }

  handleData(data) {
    const {
      id,
      details,
      instruction
    } = data;

    if (instruction == "result") {
      const {
        result
      } = details;
      return this.promises.get(id).resolve(result);
    }
  }

  call(path, args) {
    const id = randomId(32);
    const promise = new Promise(resolve => {
      this.promises.set(id, {
        resolve
      });
    });

    const send = () => this.transport.send({
      instruction: "call",
      details: {
        path,
        args
      },
      id
    });

    if (this.isConnected) send();else this.transport.on("connect", send);
    return promise;
  }

}

module.exports.Executor = Executor;
},{"./common":"../../common.js"}],"../../transports/web-worker/socket.js":[function(require,module,exports) {
const {
  EventEmitter
} = require("../../common");

class WebWorkerSocket extends EventEmitter {
  constructor(worker) {
    super();
    this.worker = worker;
    this.messageIds = new Set();
    this.connect();
  }

  connect() {
    this.worker.on("message", data => this.handleWorkerMessage(data));
    this.emit("connect");
  }

  handleWorkerMessage(event) {
    const {
      data
    } = event;
    const {
      id
    } = data;
    if (this.messageIds.delete(id)) this.emit("message", data);
  }

  send(data) {
    const {
      id
    } = data;
    this.messageIds.add(id);
    this.worker.postMessage(data);
  }

}

module.exports.WebWorkerSocket = WebWorkerSocket;
},{"../../common":"../../common.js"}],"../../transports/web-worker/server.js":[function(require,module,exports) {
const {
  WebWorkerSocket
} = require("./socket");

const {
  EventEmitter
} = require("../../common");

class WrappedWebWorker extends EventEmitter {
  constructor(worker) {
    super();
    this.worker = worker;

    this.worker.onmessage = message => this.emit("message", message);
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

class Socket extends EventEmitter {
  constructor(server) {
    super();
    this.server = server;
    this.inSocket = new inSocket(this);
  }

  connect() {
    this.emit("connect");
  }

  send(data) {
    this.server.handleIncoming(this.inSocket, data);
  }

}

class Server extends EventEmitter {
  constructor() {
    super();
    this.workers = [];
    this.messageIds = new Map();
  }

  start() {}

  addWorker(worker) {
    const wrappedWorker = new WrappedWebWorker(worker);
    const socket = new WebWorkerSocket(wrappedWorker);
    this.workers.push(wrappedWorker);
    wrappedWorker.on("message", event => {
      const {
        data
      } = event;
      this.handleIncoming(socket, data);
    });
  }

  getTransport() {
    return new Socket(this);
  }

  handleIncoming(socket, data) {
    const {
      instruction,
      details,
      id
    } = data;
    this.emit(instruction, socket, details, id);
  }

}

module.exports.Server = Server;
},{"./socket":"../../transports/web-worker/socket.js","../../common":"../../common.js"}],"../../transports/web-worker/client.js":[function(require,module,exports) {
const {
  EventEmitter
} = require("../../common");

class Client extends EventEmitter {
  constructor({
    postMessage
  }) {
    super();
    this.postMessage = postMessage;
  }

  connect() {
    this.emit("connect");
  }

  onmessage(event) {
    const {
      data
    } = event;
    this.emit("message", data);
  }

  send(data) {
    this.postMessage(data);
  }

}

module.exports.Client = Client;
},{"../../common":"../../common.js"}],"../../transports/web-worker/index.js":[function(require,module,exports) {
var _require = require("./server"),
    Server = _require.Server;

var _require2 = require("./client"),
    Client = _require2.Client;

module.exports.Server = Server;
module.exports.Client = Client;
},{"./server":"../../transports/web-worker/server.js","./client":"../../transports/web-worker/client.js"}],"test.js":[function(require,module,exports) {
const {
  Dispatcher
} = require("../../dispatcher");

const {
  Executor
} = require("../../executor");

const WebWorker = require("../../transports/web-worker");

const numCPUs = navigator.hardwareConcurrency;

const logResults = args => result => console.log(`${args.join(" ")} -> /api/add := ${result}`);

const call = server => () => {
  const transport = server.getTransport();
  const executor = new Executor(transport);
  executor.call("/api/add", [1, 2]).then(logResults([1, 2]));
  executor.call("/api/add", [2, 3]).then(logResults([2, 3]));
  executor.call("/api/add", [3, 4]).then(logResults([3, 4]));
  executor.call("/api/add", [4, 5]).then(logResults([4, 5]));
};

const dispatcher = new Dispatcher();
const transport = new WebWorker.Server();

for (let i = 0; i < numCPUs; i++) {
  const worker = new Worker("/worker.ab30da2c.js");
  transport.addWorker(worker);
}

dispatcher.addTransport(transport);
dispatcher.expectWorkers(numCPUs).then(call(transport));
},{"../../dispatcher":"../../dispatcher.js","../../executor":"../../executor.js","../../transports/web-worker":"../../transports/web-worker/index.js","./worker.js":[["worker.ab30da2c.js","worker.js"],"worker.ab30da2c.js.map","worker.js"]}],"../../../../../../opt/local/lib/node_modules/parcel/src/builtins/hmr-runtime.js":[function(require,module,exports) {
var global = arguments[3];
var OVERLAY_ID = '__parcel__error__overlay__';
var OldModule = module.bundle.Module;

function Module(moduleName) {
  OldModule.call(this, moduleName);
  this.hot = {
    data: module.bundle.hotData,
    _acceptCallbacks: [],
    _disposeCallbacks: [],
    accept: function (fn) {
      this._acceptCallbacks.push(fn || function () {});
    },
    dispose: function (fn) {
      this._disposeCallbacks.push(fn);
    }
  };
  module.bundle.hotData = null;
}

module.bundle.Module = Module;
var checkedAssets, assetsToAccept;
var parent = module.bundle.parent;

if ((!parent || !parent.isParcelRequire) && typeof WebSocket !== 'undefined') {
  var hostname = "" || location.hostname;
  var protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  var ws = new WebSocket(protocol + '://' + hostname + ':' + "59993" + '/');

  ws.onmessage = function (event) {
    checkedAssets = {};
    assetsToAccept = [];
    var data = JSON.parse(event.data);

    if (data.type === 'update') {
      var handled = false;
      data.assets.forEach(function (asset) {
        if (!asset.isNew) {
          var didAccept = hmrAcceptCheck(global.parcelRequire, asset.id);

          if (didAccept) {
            handled = true;
          }
        }
      }); // Enable HMR for CSS by default.

      handled = handled || data.assets.every(function (asset) {
        return asset.type === 'css' && asset.generated.js;
      });

      if (handled) {
        console.clear();
        data.assets.forEach(function (asset) {
          hmrApply(global.parcelRequire, asset);
        });
        assetsToAccept.forEach(function (v) {
          hmrAcceptRun(v[0], v[1]);
        });
      } else if (location.reload) {
        // `location` global exists in a web worker context but lacks `.reload()` function.
        location.reload();
      }
    }

    if (data.type === 'reload') {
      ws.close();

      ws.onclose = function () {
        location.reload();
      };
    }

    if (data.type === 'error-resolved') {
      console.log('[parcel] ✨ Error resolved');
      removeErrorOverlay();
    }

    if (data.type === 'error') {
      console.error('[parcel] 🚨  ' + data.error.message + '\n' + data.error.stack);
      removeErrorOverlay();
      var overlay = createErrorOverlay(data);
      document.body.appendChild(overlay);
    }
  };
}

function removeErrorOverlay() {
  var overlay = document.getElementById(OVERLAY_ID);

  if (overlay) {
    overlay.remove();
  }
}

function createErrorOverlay(data) {
  var overlay = document.createElement('div');
  overlay.id = OVERLAY_ID; // html encode message and stack trace

  var message = document.createElement('div');
  var stackTrace = document.createElement('pre');
  message.innerText = data.error.message;
  stackTrace.innerText = data.error.stack;
  overlay.innerHTML = '<div style="background: black; font-size: 16px; color: white; position: fixed; height: 100%; width: 100%; top: 0px; left: 0px; padding: 30px; opacity: 0.85; font-family: Menlo, Consolas, monospace; z-index: 9999;">' + '<span style="background: red; padding: 2px 4px; border-radius: 2px;">ERROR</span>' + '<span style="top: 2px; margin-left: 5px; position: relative;">🚨</span>' + '<div style="font-size: 18px; font-weight: bold; margin-top: 20px;">' + message.innerHTML + '</div>' + '<pre>' + stackTrace.innerHTML + '</pre>' + '</div>';
  return overlay;
}

function getParents(bundle, id) {
  var modules = bundle.modules;

  if (!modules) {
    return [];
  }

  var parents = [];
  var k, d, dep;

  for (k in modules) {
    for (d in modules[k][1]) {
      dep = modules[k][1][d];

      if (dep === id || Array.isArray(dep) && dep[dep.length - 1] === id) {
        parents.push(k);
      }
    }
  }

  if (bundle.parent) {
    parents = parents.concat(getParents(bundle.parent, id));
  }

  return parents;
}

function hmrApply(bundle, asset) {
  var modules = bundle.modules;

  if (!modules) {
    return;
  }

  if (modules[asset.id] || !bundle.parent) {
    var fn = new Function('require', 'module', 'exports', asset.generated.js);
    asset.isNew = !modules[asset.id];
    modules[asset.id] = [fn, asset.deps];
  } else if (bundle.parent) {
    hmrApply(bundle.parent, asset);
  }
}

function hmrAcceptCheck(bundle, id) {
  var modules = bundle.modules;

  if (!modules) {
    return;
  }

  if (!modules[id] && bundle.parent) {
    return hmrAcceptCheck(bundle.parent, id);
  }

  if (checkedAssets[id]) {
    return;
  }

  checkedAssets[id] = true;
  var cached = bundle.cache[id];
  assetsToAccept.push([bundle, id]);

  if (cached && cached.hot && cached.hot._acceptCallbacks.length) {
    return true;
  }

  return getParents(global.parcelRequire, id).some(function (id) {
    return hmrAcceptCheck(global.parcelRequire, id);
  });
}

function hmrAcceptRun(bundle, id) {
  var cached = bundle.cache[id];
  bundle.hotData = {};

  if (cached) {
    cached.hot.data = bundle.hotData;
  }

  if (cached && cached.hot && cached.hot._disposeCallbacks.length) {
    cached.hot._disposeCallbacks.forEach(function (cb) {
      cb(bundle.hotData);
    });
  }

  delete bundle.cache[id];
  bundle(id);
  cached = bundle.cache[id];

  if (cached && cached.hot && cached.hot._acceptCallbacks.length) {
    cached.hot._acceptCallbacks.forEach(function (cb) {
      cb();
    });

    return true;
  }
}
},{}]},{},["../../../../../../opt/local/lib/node_modules/parcel/src/builtins/hmr-runtime.js","test.js"], null)
//# sourceMappingURL=/test.e98b79dd.js.map