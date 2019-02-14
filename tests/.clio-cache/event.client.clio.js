module.exports = async function(scope, builtins, file) {
    var ws_connections = [];
    await builtins.setup_ws(ws_connections, 'ws://localhost:3000');
    scope['source'] = await builtins.ws_get(ws_connections['ws://localhost:3000'], 'source');;
    scope['counter'] = await builtins.ws_get(ws_connections['ws://localhost:3000'], 'counter');;
    await (async function(__data) {
        var fn = async function(__data) {
            return await builtins.funcall([...__data], [], await builtins.funcall(['print'], [scope], builtins.get_symbol, file, {
                index: 75,
                fn: '<get-symbol>'
            }), file, {
                index: 75,
                fn: 'print'
            })
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })([(new builtins.EventListener(await builtins.value(await builtins.funcall(['source'], [scope], builtins.get_symbol, file, {
        index: 59,
        fn: '<get-symbol>'
    })), 'tick'))]);
    for (var server in ws_connections) {
        if (ws_connections.hasOwnProperty(server)) {
            if (ws_connections[server].emitters == {}) {
                ws_connections[server].socket.close()
            }
        }
    }
    return scope;
};