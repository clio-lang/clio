const cluster = require("cluster");
const express = require("express");
const cpuCount = require("os").cpus().length;
const bodyParser = require("body-parser");
const { jsonReviver, jsonReplacer } = require("../internals/json");
const enableWs = require("express-ws");
const uuid4 = require("uuid/v4");

let { EventEmitter } = require("../internals/types");

function findEmitters(obj) {
  // currently only checks if obj is a emitter
  // we need to check more complex and nested objects
  if (!obj) {
    return [];
  }
  if (obj.constructor === EventEmitter) {
    return [obj];
  }
  return [];
}

async function clioHost(scope, rootDir) {
  let config = await scope.host;
  let exported = {};
  await config.exports.map(async e => {
    exported[e] = scope[e];
  });

  /**
   * User configured port.
   * Default is 3000
   */
  const port = config.port ? config.port : 3000;

  /**
   * Define how many workers to spawn.
   * Check if there are enough CPUs available
   * before spawning 'em all.
   */
  const workers = () => {
    if (config.workers) {
      const reqWorkers = Number(config.workers);

      if (reqWorkers > cpuCount) {
        console.log(
          `Unable to use ${reqWorkers}. Current CPU only supports ${cpuCount} workers`
        );
        console.log(`Switching to ${cpuCount} workers`);
        return cpuCount;
      } else {
        return reqWorkers;
      }
    } else {
      return cpuCount;
    }
  };

  if (cluster.isMaster) {
    console.log(
      `Starting a cluster consisting of ${workers()} workers, on port ${port}`
    );

    for (let i = 0; i < workers(); i++) {
      cluster.fork();
    }
  } else {
    if (rootDir) {
      process.chdir(rootDir);
    }

    // Workers share the TCP connection in this server
    let app = express();
    enableWs(app);

    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(
      bodyParser.json({
        type: req => req.get("Content-Type") === "application/clio-cloud-call",
        reviver: jsonReviver
      })
    );
    app.set("json replacer", jsonReplacer);

    app.post("/execute", async function(req, res) {
      let fnName = req.body.fnName;
      let args = req.body.args;
      let fn = scope[fnName];
      let result = await fn(...args);
      res.json({ result: result });
    });

    app.connected = {};
    app.appConnected = 0;

    app.ws("/connect", ws => {
      let cleanups = [];
      let emitters = {};

      ws.on("message", async msg => {
        let data = JSON.parse(msg, jsonReviver);
        let method = data.method;
        if (method === "execute") {
          let fnName = data.fnName;
          let args = data.args;
          const fn = scope[fnName];
          let result = await fn(...args);
          let resultEmitters = findEmitters(result);
          resultEmitters.forEach(function(emitter) {
            // these are passed by reference, so it's safe
            // to assign the uuid like this
            let uuid = uuid4();
            while (emitters.hasOwnProperty(uuid)) {
              uuid = uuid4(); // to avoid collisions!
              // althought it may exist on client!
            }
            emitter.uuid = uuid;
            emitters.uuid = emitter;
            let fn = async function(data) {
              data = await data;
              return ws.send(
                JSON.stringify(
                  {
                    service: "update",
                    emitter: uuid,
                    data: data,
                    event: this.event
                  },
                  jsonReplacer
                )
              );
            };
            emitter.on("*", fn);
            cleanups.push(function() {
              emitter.off("*", fn);
            });
          });
          data = JSON.stringify({ result: result, id: data.id }, jsonReplacer);
          ws.send(data);
        } else if (method === "get") {
          let key = data.key;
          let val = await scope[key];
          let constructor = val.constructor;
          let type;
          if (val instanceof Function) {
            type = "function";
          } else if (constructor === EventEmitter) {
            type = "emitter";
            // subscribe this client
            const fn = async function(data) {
              data = await data;
              return ws.send(
                JSON.stringify(
                  {
                    service: "update",
                    emitter: key,
                    data: data,
                    event: this.event
                  },
                  jsonReplacer
                )
              );
            };
            val.on("*", fn);
            cleanups.push(function() {
              val.off("*", fn);
            });
          }
          data = JSON.stringify({ type: type, id: data.id }, jsonReplacer);
          ws.send(data);
        }
      });

      ws.on("close", () => {
        cleanups.forEach(cleanup => cleanup());
      });
    });

    // All workers use this port
    app.listen(port);
  }
}

module.exports = clioHost;
