const cluster = require('cluster');
const express = require('express');
const cpu_count = require('os').cpus().length;
const body_parser = require("body-parser");
const path = require('path');
const fs = require('fs');
const {jsonReviver, jsonReplacer} = require('../internals/json');
const {value} = require('../internals/lazy');
const enableWs = require('express-ws');
const uuid4 = require('uuid/v4');

var { Transform, AtSign, Decimal, Generator, Property,
  EventListener, Broadcast, EventEmitter } = require('../internals/types');

function find_emitters(obj) {
  // currently only checks if obj is a emitter
  // we should support Clio Generators to check
  // for more complex data types
  if (!obj) {
    return [];
  }
  if (obj.constructor == EventEmitter) {
    return [obj]
  }
  return []
}

async function clio_host(scope, root_dir) {

  scope = await scope;
  var config = await scope.host;
  var exported = {};
  await config.exports.map(async e => {exported[e] = scope[e]});

  /**
   * User configured port.
   * Default is 3000
   */
  const port = config.port ? Number(config.port) : 3000;

  /**
   * Define how many workers to spawn.
   * Check if there are enough CPUs available
   * before spawning 'em all.
   */
  const workers = () => {
    if (config.workers) {

      const reqWorkers = Number(config.workers);

      if (reqWorkers > cpu_count) {
        console.log(`Unable to use ${reqWorkers}. Current CPU only supports ${cpu_count} workers`);
        console.log(`Switching to ${cpu_count} workers`);
        return cpu_count;

      } else {
        return reqWorkers;
      }

    } else {
      return cpu_count;
    }
  }

  if (cluster.isMaster) {

      console.log(`Starting a cluster consisting of ${workers()} workers, on port ${port}`);

      for (var i = 0; i < workers(); i++) {
          cluster.fork();
      }

  } else {

      if (root_dir) {
        process.chdir(root_dir)
      }

      // Workers share the TCP connection in this server
      var app = express();
      enableWs(app);

      app.use(body_parser.urlencoded({ extended: false }));
      app.use(body_parser.json({
        type: req => req.get('Content-Type') === 'application/clio-cloud-call',
        reviver: jsonReviver,
      }));
      app.set('json replacer', jsonReplacer);

      app.post('/execute', async function (req, res) {
        var fn_name = req.body.fn_name;
        var args = req.body.args;
        var fn = scope[fn_name];
        var result = await value(fn(...args));
        res.json({result: result})
      });

      app.connected = {}
      app.no_connected = 0;

      app.ws('/connect', (ws, req) => {

          var cleanups = [];
          var emitters = {};

          ws.on('message', async msg => {
              var data = JSON.parse(msg, jsonReviver);
              var method = data.method;
              if (method == 'execute') {
                var fn_name = data.fn_name;
                var args = data.args;
                var fn = scope[fn_name];
                var result = await value(fn(...args));
                var result_emitters = find_emitters(result);
                result_emitters.forEach(function (emitter) {
                  // these are passed by reference, so it's safe
                  // to assign the uuid like this
                  var uuid = uuid4();
                  while (emitters.hasOwnProperty(uuid)) {
                    uuid = uuid4(); // to avoid collisions!
                    // althought it may exist on client!
                  }
                  emitter.uuid = uuid;
                  emitters.uuid = emitter;
                  var fn = async function (data) {
                    data = await value(data);
                    return ws.send(
                      JSON.stringify({service: 'update', emitter: uuid, data: data, event: this.event}, jsonReplacer)
                    )
                  }
                  emitter.on('*', fn);
                  cleanups.push(function () {
                    emitter.off('*', fn);
                  });
                });
                data = JSON.stringify({result: result, id: data.id}, jsonReplacer);
                ws.send(data);
              } else if (method == 'get') {
                var key = data.key;
                var val = await value(scope[key]);
                var constructor = val.constructor;
                var type;
                if (val instanceof Function) {
                  type = 'function';
                } else if (constructor == EventEmitter) {
                  type = 'emitter';
                  // subscribe this client
                  var fn = async function (data) {
                    data = await value(data);
                    return ws.send(
                      JSON.stringify({service: 'update', emitter: key, data: data, event: this.event}, jsonReplacer)
                    )
                  }
                  val.on('*', fn);
                  cleanups.push(function () {
                    val.off('*', fn);
                  })
                }
                data = JSON.stringify({type: type, id: data.id}, jsonReplacer);
                ws.send(data)
              }
          })

          ws.on('close', () => {
              cleanups.forEach(cleanup => cleanup());
          })
      })

      // All workers use this port
      app.listen(port);
  }
}

module.exports = clio_host
