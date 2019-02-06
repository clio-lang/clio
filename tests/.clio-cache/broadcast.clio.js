module.exports = async function(scope, builtins, file) {
    var ws_connections = [];
    await builtins.setup_ws(ws_connections, 'ws://localhost:3000');
    scope['source'] = await builtins.ws_get(ws_connections['ws://localhost:3000'], 'source');;
    await (async function(__data) {
        var fn = async function(...__data) {
            return await builtins.funcall([...__data], [`Seconds since start:`, (new builtins.AtSign(0))], await builtins.funcall(['print'], [scope], builtins.get_symbol, file, {
                index: 67,
                fn: '<get-symbol>'
            }), file, {
                index: 67,
                fn: 'print'
            })
        }
        if (__data.is_reactive) {
            return __data.set_listener(fn)
        } else {
            return await fn(__data)
        }
    })((new builtins.EventListener(await builtins.funcall(['source'], [scope], builtins.get_symbol, file, {
        index: 51,
        fn: '<get-symbol>'
    }), 'data')));
    for (var server in ws_connections) {
        if (ws_connections.hasOwnProperty(server)) {
            if (ws_connections[server].broadcasts == {}) {
                ws_connections[server].socket.close()
            }
        }
    }
    return scope;
};