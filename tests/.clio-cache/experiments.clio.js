module.exports = async function(scope, builtins, file) {
    await (async function(__data) {
        var fn = async function(...__data) {
            return (scope['ee'] = await builtins.funcall([...__data], [], await builtins.funcall(['emitter'], [scope], builtins.get_symbol, file, {
                index: 12,
                fn: '<get-symbol>'
            }), file, {
                index: 12,
                fn: 'emitter'
            }))
        }
        if (__data.is_reactive) {
            return __data.set_listener(fn)
        } else {
            return await fn(__data)
        }
    })('emitter');
    await (async function(__data) {
        var fn = async function(...__data) {
            return await builtins.funcall([await builtins.funcall([...__data], [], await builtins.funcall(['upper'], [scope], builtins.get_symbol, file, {
                index: 41,
                fn: '<get-symbol>'
            }), file, {
                index: 41,
                fn: 'upper'
            })], [], await builtins.funcall(['print'], [scope], builtins.get_symbol, file, {
                index: 50,
                fn: '<get-symbol>'
            }), file, {
                index: 50,
                fn: 'print'
            })
        }
        if (__data.is_reactive) {
            return __data.set_listener(fn)
        } else {
            return await fn(__data)
        }
    })((new builtins.EventListener(await builtins.funcall(['ee'], [scope], builtins.get_symbol, file, {
        index: 26,
        fn: '<get-symbol>'
    }), 'message')));
    await (async function(__data) {
        var fn = async function(...__data) {
            return await builtins.funcall([...__data], ['message', 'hello'], await builtins.funcall(['emit'], [scope], builtins.get_symbol, file, {
                index: 63,
                fn: '<get-symbol>'
            }), file, {
                index: 63,
                fn: 'emit'
            })
        }
        if (__data.is_reactive) {
            return __data.set_listener(fn)
        } else {
            return await fn(__data)
        }
    })(await builtins.funcall(['ee'], [scope], builtins.get_symbol, file, {
        index: 57,
        fn: '<get-symbol>'
    }));
    await (async function(__data) {
        var fn = async function(...__data) {
            return await builtins.funcall([...__data], ['message', 'world'], await builtins.funcall(['emit'], [scope], builtins.get_symbol, file, {
                index: 90,
                fn: '<get-symbol>'
            }), file, {
                index: 90,
                fn: 'emit'
            })
        }
        if (__data.is_reactive) {
            return __data.set_listener(fn)
        } else {
            return await fn(__data)
        }
    })(await builtins.funcall(['ee'], [scope], builtins.get_symbol, file, {
        index: 84,
        fn: '<get-symbol>'
    }));
    return scope;
};