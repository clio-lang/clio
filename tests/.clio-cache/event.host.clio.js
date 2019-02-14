module.exports = async function(scope, builtins, file) {
    var ws_connections = [];
    await (async function(__data) {
        var fn = async function(__data) {
            return (await builtins.update_vars(scope, ['source'], await builtins.funcall([...__data], [], await builtins.funcall(['emitter'], [scope], builtins.get_symbol, file, {
                index: 25,
                fn: '<get-symbol>'
            }), file, {
                index: 25,
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
    })([`emitter`]);
    builtins.define_function((function(scope) {
        var func = builtins.lazy(async function(i, source) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            ['i', 'source'].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            return await (async function(__data) {
                var fn = async function(__data) {
                    return await builtins.funcall([...__data], ['tick', await builtins.funcall(['i'], [scope], builtins.get_symbol, file, {
                        index: 95,
                        fn: '<get-symbol>'
                    })], await builtins.funcall(['emit'], [scope], builtins.get_symbol, file, {
                        index: 84,
                        fn: '<get-symbol>'
                    }), file, {
                        index: 84,
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
            })([await builtins.funcall(['source'], [scope], builtins.get_symbol, file, {
                index: 74,
                fn: '<get-symbol>'
            })])
        }, true);
        func.frozenscope = Object.assign({}, scope);
        func.frozenscope['do_emit'] = func;
        func.frozenscope['recall'] = func;
        return func;
    })(scope), 'do_emit', scope);
    builtins.decorate_function(await builtins.funcall(['eager'], [scope], builtins.get_symbol, file, {
        index: 45,
        fn: '<get-symbol>'
    }), [], 'do_emit', 'default', scope);
    await (async function(__data) {
        var fn = async function(__data) {
            return await builtins.funcall([...__data], [await builtins.funcall(['do_emit'], [scope], builtins.get_symbol, file, {
                index: 115,
                fn: '<get-symbol>'
            }), await builtins.funcall(['source'], [scope], builtins.get_symbol, file, {
                index: 123,
                fn: '<get-symbol>'
            })], await builtins.funcall(['interval'], [scope], builtins.get_symbol, file, {
                index: 106,
                fn: '<get-symbol>'
            }), file, {
                index: 106,
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
    })([builtins.Decimal('1000')]);
    builtins.define_function((function(scope) {
        var func = builtins.lazy(async function(i) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            ['i'].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            await (async function(__data) {
                var fn = async function(__data) {
                    return (await builtins.update_vars(scope, ['em'], await builtins.funcall([...__data], [], await builtins.funcall(['emitter'], [scope], builtins.get_symbol, file, {
                        index: 159,
                        fn: '<get-symbol>'
                    }), file, {
                        index: 159,
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
            })([await builtins.funcall(['i'], [scope], builtins.get_symbol, file, {
                index: 154,
                fn: '<get-symbol>'
            })]);
            builtins.define_function((function(scope) {
                var func = builtins.lazy(async function(n, em) {
                    var scope = Object.assign({}, func.frozenscope);
                    var args_obj = {};
                    var _arguments = arguments;
                    ['n', 'em'].forEach(function(arg, index) {
                        scope[arg] = _arguments[index]
                    });
                    return await (async function(__data) {
                        var fn = async function(__data) {
                            return await builtins.funcall([...__data], ['tick', builtins.funcall([await builtins.funcall(['i'], [scope], builtins.get_symbol, file, {
                                index: 225,
                                fn: '<get-symbol>'
                            })], [await builtins.funcall(['n'], [scope], builtins.get_symbol, file, {
                                index: 229,
                                fn: '<get-symbol>'
                            })], builtins.add, file, {
                                index: 225,
                                fn: 'builtins.add'
                            })], await builtins.funcall(['emit'], [scope], builtins.get_symbol, file, {
                                index: 213,
                                fn: '<get-symbol>'
                            }), file, {
                                index: 213,
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
                    })([await builtins.funcall(['source'], [scope], builtins.get_symbol, file, {
                        index: 203,
                        fn: '<get-symbol>'
                    })])
                }, true);
                func.frozenscope = Object.assign({}, scope);
                func.frozenscope['count'] = func;
                func.frozenscope['recall'] = func;
                return func;
            })(scope), 'count', scope);
            builtins.decorate_function(await builtins.funcall(['eager'], [scope], builtins.get_symbol, file, {
                index: 176,
                fn: '<get-symbol>'
            }), [], 'count', 'default', scope);
            await (async function(__data) {
                var fn = async function(__data) {
                    return await builtins.funcall([...__data], [await builtins.funcall(['count'], [scope], builtins.get_symbol, file, {
                        index: 251,
                        fn: '<get-symbol>'
                    }), await builtins.funcall(['em'], [scope], builtins.get_symbol, file, {
                        index: 257,
                        fn: '<get-symbol>'
                    })], await builtins.funcall(['interval'], [scope], builtins.get_symbol, file, {
                        index: 242,
                        fn: '<get-symbol>'
                    }), file, {
                        index: 242,
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
            })([builtins.Decimal('1000')]);
            return await builtins.funcall(['em'], [scope], builtins.get_symbol, file, {
                index: 262,
                fn: '<get-symbol>'
            })
        }, true);
        func.frozenscope = Object.assign({}, scope);
        func.frozenscope['counter'] = func;
        func.frozenscope['recall'] = func;
        return func;
    })(scope), 'counter', scope);
    builtins.decorate_function(await builtins.funcall(['eager'], [scope], builtins.get_symbol, file, {
        index: 132,
        fn: '<get-symbol>'
    }), [], 'counter', 'default', scope);
    await (async function(__data) {
        var fn = async function(__data) {
            return (await builtins.update_vars(scope, ['host'], ...__data))
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })([{
        'exports': new builtins.Generator(
            (i, self) => self.data[i],
            ['source', 'counter'],
            self => self.data.length,
        )
    }]);
    for (var server in ws_connections) {
        if (ws_connections.hasOwnProperty(server)) {
            if (ws_connections[server].emitters == {}) {
                ws_connections[server].socket.close()
            }
        }
    }
    return scope;
};