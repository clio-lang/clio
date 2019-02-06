module.exports = async function(scope, builtins, file) {
    var ws_connections = [];
    await (async function(__data) {
        var fn = async function(...__data) {
            return (await builtins.update_vars(scope, ['source'], await builtins.funcall([...__data], [], await builtins.funcall(['broadcast'], [scope], builtins.get_symbol, file, {
                index: 20,
                fn: '<get-symbol>'
            }), file, {
                index: 20,
                fn: 'broadcast'
            })))
        }
        if (__data.is_reactive) {
            return __data.set_listener(fn)
        } else {
            return await fn(__data)
        }
    })(await builtins.funcall(['data'], [scope], builtins.get_symbol, file, {
        index: 12,
        fn: '<get-symbol>'
    }));
    builtins.define_function((function(scope) {
        var func = builtins.lazy(async function(i, source) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            ['i', 'source'].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            return await (async function(__data) {
                var fn = async function(...__data) {
                    return (await builtins.update_vars(scope, ['source'], ...__data))
                }
                if (__data.is_reactive) {
                    return __data.set_listener(fn)
                } else {
                    return await fn(__data)
                }
            })(await builtins.funcall(['i'], [scope], builtins.get_symbol, file, {
                index: 67,
                fn: '<get-symbol>'
            }))
        }, true);
        func.frozenscope = Object.assign({}, scope);
        func.frozenscope['put'] = func;
        func.frozenscope['recall'] = func;
        return func;
    })(scope), 'put', scope);
    builtins.decorate_function(await builtins.funcall(['eager'], [scope], builtins.get_symbol, file, {
        index: 42,
        fn: '<get-symbol>'
    }), [], 'put', 'default', scope);
    await (async function(__data) {
        var fn = async function(...__data) {
            return await builtins.funcall([...__data], [await builtins.funcall(['put'], [scope], builtins.get_symbol, file, {
                index: 97,
                fn: '<get-symbol>'
            }), await builtins.funcall(['source'], [scope], builtins.get_symbol, file, {
                index: 101,
                fn: '<get-symbol>'
            })], await builtins.funcall(['interval'], [scope], builtins.get_symbol, file, {
                index: 88,
                fn: '<get-symbol>'
            }), file, {
                index: 88,
                fn: 'interval'
            })
        }
        if (__data.is_reactive) {
            return __data.set_listener(fn)
        } else {
            return await fn(__data)
        }
    })(builtins.Decimal('1000'));
    builtins.define_function((function(scope) {
        var func = builtins.lazy(async function(i) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            ['i'].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            await (async function(__data) {
                var fn = async function(...__data) {
                    return (await builtins.update_vars(scope, ['br'], await builtins.funcall([...__data], [], await builtins.funcall(['broadcast'], [scope], builtins.get_symbol, file, {
                        index: 137,
                        fn: '<get-symbol>'
                    }), file, {
                        index: 137,
                        fn: 'broadcast'
                    })))
                }
                if (__data.is_reactive) {
                    return __data.set_listener(fn)
                } else {
                    return await fn(__data)
                }
            })(await builtins.funcall(['i'], [scope], builtins.get_symbol, file, {
                index: 132,
                fn: '<get-symbol>'
            }));
            builtins.define_function((function(scope) {
                var func = builtins.lazy(async function(n, br) {
                    var scope = Object.assign({}, func.frozenscope);
                    var args_obj = {};
                    var _arguments = arguments;
                    ['n', 'br'].forEach(function(arg, index) {
                        scope[arg] = _arguments[index]
                    });
                    return await (async function(__data) {
                        var fn = async function(...__data) {
                            return (await builtins.update_vars(scope, ['br'], ...__data))
                        }
                        if (__data.is_reactive) {
                            return __data.set_listener(fn)
                        } else {
                            return await fn(__data)
                        }
                    })(builtins.funcall([await builtins.funcall(['i'], [scope], builtins.get_symbol, file, {
                        index: 183,
                        fn: '<get-symbol>'
                    })], [await builtins.funcall(['n'], [scope], builtins.get_symbol, file, {
                        index: 187,
                        fn: '<get-symbol>'
                    })], builtins.add, file, {
                        index: 183,
                        fn: 'builtins.add'
                    }))
                }, true);
                func.frozenscope = Object.assign({}, scope);
                func.frozenscope['count'] = func;
                func.frozenscope['recall'] = func;
                return func;
            })(scope), 'count', scope);
            builtins.decorate_function(await builtins.funcall(['eager'], [scope], builtins.get_symbol, file, {
                index: 156,
                fn: '<get-symbol>'
            }), [], 'count', 'default', scope);
            await (async function(__data) {
                var fn = async function(...__data) {
                    return await builtins.funcall([...__data], [await builtins.funcall(['count'], [scope], builtins.get_symbol, file, {
                        index: 214,
                        fn: '<get-symbol>'
                    }), await builtins.funcall(['br'], [scope], builtins.get_symbol, file, {
                        index: 220,
                        fn: '<get-symbol>'
                    })], await builtins.funcall(['interval'], [scope], builtins.get_symbol, file, {
                        index: 205,
                        fn: '<get-symbol>'
                    }), file, {
                        index: 205,
                        fn: 'interval'
                    })
                }
                if (__data.is_reactive) {
                    return __data.set_listener(fn)
                } else {
                    return await fn(__data)
                }
            })(builtins.Decimal('1000'));
            return await builtins.funcall(['br'], [scope], builtins.get_symbol, file, {
                index: 225,
                fn: '<get-symbol>'
            })
        }, true);
        func.frozenscope = Object.assign({}, scope);
        func.frozenscope['counter'] = func;
        func.frozenscope['recall'] = func;
        return func;
    })(scope), 'counter', scope);
    builtins.decorate_function(await builtins.funcall(['eager'], [scope], builtins.get_symbol, file, {
        index: 110,
        fn: '<get-symbol>'
    }), [], 'counter', 'default', scope);
    await (async function(__data) {
        var fn = async function(...__data) {
            return (await builtins.update_vars(scope, ['host'], ...__data))
        }
        if (__data.is_reactive) {
            return __data.set_listener(fn)
        } else {
            return await fn(__data)
        }
    })({
        'exports': new builtins.Generator(
            (i, self) => self.data[i],
            ['source', 'counter'],
            self => self.data.length,
        )
    });
    for (var server in ws_connections) {
        if (ws_connections.hasOwnProperty(server)) {
            if (ws_connections[server].broadcasts == {}) {
                ws_connections[server].socket.close()
            }
        }
    }
    return scope;
};