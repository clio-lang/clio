module.exports = async function(scope, builtins, file) {
    var ws_connections = [];
    ws_connections['ws://localhost:3000'] = {
        socket: new WebSocket('ws://localhost:3000/execute'),
        id: 0,
        promises: {}
    };
    ws_connections['ws://localhost:3000'].socket.onmessage = function(event) {
        var data = builtins.revive(event.data);
        ws_connections['ws://localhost:3000'].promises[data.id.toNumber()](data);
    }
    await new Promise(function(resolve, reject) {
        ws_connections['ws://localhost:3000'].socket.onopen = resolve;
    });
    scope['heavy'] = builtins.lazy(function(...args) {
        return builtins.ws_call(ws_connections['ws://localhost:3000'], 'heavy', args, {});
    }, true);;
    await (async function(__data) {
        var fn = async function(...__data) {
            return await builtins.starmap([await builtins.starmap([...__data], await builtins.funcall(['heavy'], [scope], builtins.get_symbol, file, {
                index: 56,
                fn: '<get-symbol>'
            }), [], file, {
                index: 56,
                fn: 'heavy'
            })], await builtins.funcall(['print'], [scope], builtins.get_symbol, file, {
                index: 67,
                fn: '<get-symbol>'
            }), [], file, {
                index: 67,
                fn: 'print'
            })
        }
        if (__data.is_reactive) {
            return __data.set_listener(fn)
        } else {
            return await fn(__data)
        }
    })(new builtins.Generator(
        (i, self) => self.data[i],
        [builtins.Decimal('1'), builtins.Decimal('2'), builtins.Decimal('3'), builtins.Decimal('4'), builtins.Decimal('5')],
        self => self.data.length,
    ));
    for (var server in ws_connections) {
        if (ws_connections.hasOwnProperty(server)) {
            ws_connections[server].socket.close()
        }
    }
    return scope;
};