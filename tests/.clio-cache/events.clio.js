module.exports = async function(scope, builtins, file) {
    var ws_connections = [];
    await (async function(__data) {
        var fn = async function(__data) {
            return (await builtins.update_vars(scope, ['ee'], await builtins.funcall([...__data], [], await builtins.funcall(['emitter'], [scope], builtins.get_symbol, file, {
                index: 12,
                fn: '<get-symbol>'
            }), file, {
                index: 12,
                fn: 'emitter'
            })))
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })(['emitter']);
    await (async function(__data) {
        var fn = async function(__data) {
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
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })([(new builtins.EventListener(await builtins.value(await builtins.funcall(['ee'], [scope], builtins.get_symbol, file, {
        index: 26,
        fn: '<get-symbol>'
    })), 'message'))]);
    await (async function(__data) {
        var fn = async function(__data) {
            return await builtins.funcall([...__data], ['message', 'hello'], await builtins.funcall(['emit'], [scope], builtins.get_symbol, file, {
                index: 63,
                fn: '<get-symbol>'
            }), file, {
                index: 63,
                fn: 'emit'
            })
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })([await builtins.funcall(['ee'], [scope], builtins.get_symbol, file, {
        index: 57,
        fn: '<get-symbol>'
    })]);
    await (async function(__data) {
        var fn = async function(__data) {
            return await builtins.funcall([...__data], ['message', 'world'], await builtins.funcall(['emit'], [scope], builtins.get_symbol, file, {
                index: 90,
                fn: '<get-symbol>'
            }), file, {
                index: 90,
                fn: 'emit'
            })
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })([await builtins.funcall(['ee'], [scope], builtins.get_symbol, file, {
        index: 84,
        fn: '<get-symbol>'
    })]);
    builtins.define_function((function(scope) {
        var func = builtins.lazy(async function(i, ee) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            ['i', 'ee'].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            return await (async function(__data) {
                var fn = async function(__data) {
                    return await builtins.funcall([await builtins.funcall([await builtins.funcall([...__data], [`-`], await builtins.funcall(['cat'], [scope], builtins.get_symbol, file, {
                        index: 155,
                        fn: '<get-symbol>'
                    }), file, {
                        index: 155,
                        fn: 'cat'
                    })], [await builtins.funcall(['i'], [scope], builtins.get_symbol, file, {
                        index: 170,
                        fn: '<get-symbol>'
                    })], await builtins.funcall(['cat'], [scope], builtins.get_symbol, file, {
                        index: 166,
                        fn: '<get-symbol>'
                    }), file, {
                        index: 166,
                        fn: 'cat'
                    })], [await builtins.funcall(['ee'], [scope], builtins.get_symbol, file, {
                        index: 180,
                        fn: '<get-symbol>'
                    }), 'message', (new builtins.AtSign(0))], await builtins.funcall(['emit'], [scope], builtins.get_symbol, file, {
                        index: 175,
                        fn: '<get-symbol>'
                    }), file, {
                        index: 175,
                        fn: 'emit'
                    })
                }
                if (__data[0].is_reactive) {
                    return __data[0].set_listener(function(n) {
                        return fn([n, ...__data.slice(1)])
                    })
                } else {
                    return await fn(__data)
                }
            })(['message'])
        }, true);
        func.frozenscope = Object.assign({}, scope);
        func.frozenscope['emit_message'] = func;
        func.frozenscope['recall'] = func;
        return func;
    })(scope), 'emit_message', scope);
    builtins.decorate_function(await builtins.funcall(['eager'], [scope], builtins.get_symbol, file, {
        index: 113,
        fn: '<get-symbol>'
    }), [], 'emit_message', 'default', scope);
    await (async function(__data) {
        var fn = async function(__data) {
            return await builtins.funcall([...__data], [await builtins.funcall(['emit_message'], [scope], builtins.get_symbol, file, {
                index: 212,
                fn: '<get-symbol>'
            }), await builtins.funcall(['ee'], [scope], builtins.get_symbol, file, {
                index: 225,
                fn: '<get-symbol>'
            })], await builtins.funcall(['interval'], [scope], builtins.get_symbol, file, {
                index: 203,
                fn: '<get-symbol>'
            }), file, {
                index: 203,
                fn: 'interval'
            })
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })([builtins.Decimal('5000')]);
    for (var server in ws_connections) {
        if (ws_connections.hasOwnProperty(server)) {
            if (ws_connections[server].broadcasts == {}) {
                ws_connections[server].socket.close()
            }
        }
    }
    return scope;
};