var cluster = require('cluster');
var express = require('express');
var cpu_count = require('os').cpus().length;
var body_parser = require("body-parser");
const path = require('path');
const fs = require('fs');
const {jsonReviver, jsonReplacer} = require('../internals/json');
const {value} = require('../internals/lazy');
const enableWs = require('express-ws');

var { Transform, AtSign, Decimal, Generator, Property, EventListener, Broadcast } = require('../internals/types');

async function clio_host(scope, port) {

  scope = await scope;
  var config = await scope.host;
  var exported = {};
  await config.exports.map(async e => {exported[e] = scope[e]});

  if (!port) {
    port = 3000;
  }

  if (cluster.isMaster) {
      for (var i = 0; i < cpu_count; i++) {
          cluster.fork();
      }
  } else {
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

          ws.on('message', async msg => {
              var data = JSON.parse(msg, jsonReviver);
              var method = data.method;
              if (method == 'execute') {
                var fn_name = data.fn_name;
                var args = data.args;
                var fn = scope[fn_name];
                var result = await value(fn(...args));
                data = JSON.stringify({result: result, id: data.id}, jsonReplacer);
                ws.send(data);
              } else if (method == 'get') {
                var key = data.key;
                var val = await value(scope[key]);
                var constructor = val.constructor;
                var type;
                if (constructor == Function) {
                  type = 'function';
                } else if (constructor == Broadcast) {
                  type = 'broadcast';
                  // subscribe this client
                  var fn = function (data) {
                    return ws.send(
                      JSON.stringify({service: 'update', broadcast: key, data: data}, jsonReplacer)
                    )
                  }
                  val.on('data', fn);
                  cleanups.push(function () {
                    val.off('data', fn);
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
  return port;
}

module.exports = clio_host
