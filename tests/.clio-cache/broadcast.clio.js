module.exports = async function(scope, builtins, file) {
    var ws_connections = [];
    await builtins.setup_ws(ws_connections, 'ws://localhost:3000');
    scope['source'] = await builtins.ws_get(ws_connections['ws://localhost:3000'], 'source');;
    scope['counter'] = await builtins.ws_get(ws_connections['ws://localhost:3000'], 'counter');;
    await (async function(__data) {
        var fn = async function(...__data) {
            return (await builtins.update_vars(scope, ['c1'], await builtins.funcall([...__data], [], await builtins.funcall(['counter'], [scope], builtins.get_symbol, file, {
                index: 115,
                fn: '<get-symbol>'
            }), file, {
                index: 115,
                fn: 'counter'
            })))
        }
        if (__data.is_reactive) {
            return __data.set_listener(fn)
        } else {
            return await fn(__data)
        }
    })(builtins.Decimal('100'));
    await (async function(__data) {
        var fn = async function(...__data) {
            return (await builtins.update_vars(scope, ['c2'], await builtins.funcall([...__data], [], await builtins.funcall(['counter'], [scope], builtins.get_symbol, file, {
                index: 137,
                fn: '<get-symbol>'
            }), file, {
                index: 137,
                fn: 'counter'
            })))
        }
        if (__data.is_reactive) {
            return __data.set_listener(fn)
        } else {
            return await fn(__data)
        }
    })(builtins.Decimal('1000'));
    await (async function(__data) {
        var fn = async function(...__data) {
            return await builtins.funcall([...__data], [`c1 tick:`, (new builtins.AtSign(0))], await builtins.funcall(['print'], [scope], builtins.get_symbol, file, {
                index: 164,
                fn: '<get-symbol>'
            }), file, {
                index: 164,
                fn: 'print'
            })
        }
        if (__data.is_reactive) {
            return __data.set_listener(fn)
        } else {
            return await fn(__data)
        }
    })((new builtins.EventListener(await builtins.value(await builtins.funcall(['c1'], [scope], builtins.get_symbol, file, {
        index: 152,
        fn: '<get-symbol>'
    })), 'data')));
    await (async function(__data) {
        var fn = async function(...__data) {
            return await builtins.funcall([...__data], [`c2 tick:`, (new builtins.AtSign(0))], await builtins.funcall(['print'], [scope], builtins.get_symbol, file, {
                index: 195,
                fn: '<get-symbol>'
            }), file, {
                index: 195,
                fn: 'print'
            })
        }
        if (__data.is_reactive) {
            return __data.set_listener(fn)
        } else {
            return await fn(__data)
        }
    })((new builtins.EventListener(await builtins.value(await builtins.funcall(['c2'], [scope], builtins.get_symbol, file, {
        index: 183,
        fn: '<get-symbol>'
    })), 'data')));
    for (var server in ws_connections) {
        if (ws_connections.hasOwnProperty(server)) {
            if (ws_connections[server].broadcasts == {}) {
                ws_connections[server].socket.close()
            }
        }
    }
    return scope;
};