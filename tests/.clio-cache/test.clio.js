module.exports = async function(scope, builtins, file) {
    var ws_connections = [];
    await (async function(__data) {
        var fn = async function(__data) {
            return (await builtins.update_vars(scope, ['a'], ...__data))
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })([builtins.Decimal('2')]);
    await (async function(__data) {
        var fn = async function(__data) {
            return (await builtins.update_vars(scope, ['b'], ...__data))
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })([builtins.Decimal('3')]);
    await (async function(__data) {
        var fn = async function(__data) {
            return (await builtins.update_vars(scope, ['a_plus_b'], ...__data))
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })([builtins.funcall([await builtins.funcall(['a'], [scope], builtins.get_symbol, file, {
        index: 15,
        fn: '<get-symbol>'
    })], [await builtins.funcall(['b'], [scope], builtins.get_symbol, file, {
        index: 19,
        fn: '<get-symbol>'
    })], builtins.add, file, {
        index: 15,
        fn: 'builtins.add'
    })]);
    await (async function(__data) {
        var fn = async function(__data) {
            return (await builtins.update_vars(scope, ['a_minus_b'], ...__data))
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })([builtins.funcall([await builtins.funcall(['a'], [scope], builtins.get_symbol, file, {
        index: 33,
        fn: '<get-symbol>'
    })], [await builtins.funcall(['b'], [scope], builtins.get_symbol, file, {
        index: 37,
        fn: '<get-symbol>'
    })], builtins.dec, file, {
        index: 33,
        fn: 'builtins.dec'
    })]);
    await (async function(__data) {
        var fn = async function(__data) {
            return (await builtins.update_vars(scope, ['a_mul_b'], ...__data))
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })([builtins.funcall([await builtins.funcall(['a'], [scope], builtins.get_symbol, file, {
        index: 52,
        fn: '<get-symbol>'
    })], [await builtins.funcall(['b'], [scope], builtins.get_symbol, file, {
        index: 56,
        fn: '<get-symbol>'
    })], builtins.mul, file, {
        index: 52,
        fn: 'builtins.mul'
    })]);
    await (async function(__data) {
        var fn = async function(__data) {
            return (await builtins.update_vars(scope, ['a_div_b'], ...__data))
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })([builtins.funcall([await builtins.funcall(['a'], [scope], builtins.get_symbol, file, {
        index: 69,
        fn: '<get-symbol>'
    })], [await builtins.funcall(['b'], [scope], builtins.get_symbol, file, {
        index: 73,
        fn: '<get-symbol>'
    })], builtins.div, file, {
        index: 69,
        fn: 'builtins.div'
    })]);
    await (async function(__data) {
        var fn = async function(__data) {
            return (await builtins.update_vars(scope, ['a_pow_b'], ...__data))
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })([builtins.funcall([await builtins.funcall(['a'], [scope], builtins.get_symbol, file, {
        index: 86,
        fn: '<get-symbol>'
    })], [await builtins.funcall(['b'], [scope], builtins.get_symbol, file, {
        index: 90,
        fn: '<get-symbol>'
    })], builtins.pow, file, {
        index: 86,
        fn: 'builtins.pow'
    })]);
    await (async function(__data) {
        var fn = async function(__data) {
            return (await builtins.update_vars(scope, ['a_mod_b'], ...__data))
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })([builtins.funcall([await builtins.funcall(['a'], [scope], builtins.get_symbol, file, {
        index: 103,
        fn: '<get-symbol>'
    })], [await builtins.funcall(['b'], [scope], builtins.get_symbol, file, {
        index: 107,
        fn: '<get-symbol>'
    })], builtins.mod, file, {
        index: 103,
        fn: 'builtins.mod'
    })]);
    await (async function(__data) {
        var fn = async function(__data) {
            return (await builtins.update_vars(scope, ['chain'], await builtins.funcall([await builtins.funcall([await builtins.funcall([...__data], [builtins.Decimal('1')], await builtins.funcall(['add'], [scope], builtins.get_symbol, file, {
                index: 126,
                fn: '<get-symbol>'
            }), file, {
                index: 126,
                fn: 'add'
            })], [builtins.Decimal('2')], await builtins.funcall(['mul'], [scope], builtins.get_symbol, file, {
                index: 135,
                fn: '<get-symbol>'
            }), file, {
                index: 135,
                fn: 'mul'
            })], [builtins.Decimal('3')], await builtins.funcall(['pow'], [scope], builtins.get_symbol, file, {
                index: 144,
                fn: '<get-symbol>'
            }), file, {
                index: 144,
                fn: 'pow'
            })))
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })([await builtins.funcall(['a'], [scope], builtins.get_symbol, file, {
        index: 121,
        fn: '<get-symbol>'
    })]);
    builtins.define_function((function(scope) {
        var func = builtins.lazy(async function(n) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            ['n'].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            if (await builtins.funcall([await builtins.funcall([await builtins.funcall(['n'], [scope], builtins.get_symbol, file, {
                    index: 175,
                    fn: '<get-symbol>'
                })], [builtins.Decimal('2')], builtins.lt, file, {
                    index: 175,
                    fn: 'builtins.lt'
                })], [], builtins.bool, file, {
                    index: 172,
                    fn: '<conditional>'
                })) {
                return await builtins.funcall(['n'], [scope], builtins.get_symbol, file, {
                    index: 182,
                    fn: '<get-symbol>'
                })
            } else {
                return builtins.funcall([await (async function(__data) {
                    var fn = async function(__data) {
                        return await builtins.funcall([...__data], [], await builtins.funcall(['fib'], [scope], builtins.get_symbol, file, {
                            index: 202,
                            fn: '<get-symbol>'
                        }), file, {
                            index: 202,
                            fn: 'fib'
                        })
                    }
                    if (__data[0].is_reactive) {
                        return __data[0].set_listener(function(n) {
                            return fn([n, ...__data.slice(1)])
                        })
                    } else {
                        return await fn(__data)
                    }
                })([builtins.funcall([await builtins.funcall(['n'], [scope], builtins.get_symbol, file, {
                    index: 193,
                    fn: '<get-symbol>'
                })], [builtins.Decimal('1')], builtins.dec, file, {
                    index: 193,
                    fn: 'builtins.dec'
                })])], [await (async function(__data) {
                    var fn = async function(__data) {
                        return await builtins.funcall([...__data], [], await builtins.funcall(['fib'], [scope], builtins.get_symbol, file, {
                            index: 219,
                            fn: '<get-symbol>'
                        }), file, {
                            index: 219,
                            fn: 'fib'
                        })
                    }
                    if (__data[0].is_reactive) {
                        return __data[0].set_listener(function(n) {
                            return fn([n, ...__data.slice(1)])
                        })
                    } else {
                        return await fn(__data)
                    }
                })([builtins.funcall([await builtins.funcall(['n'], [scope], builtins.get_symbol, file, {
                    index: 210,
                    fn: '<get-symbol>'
                })], [builtins.Decimal('2')], builtins.dec, file, {
                    index: 210,
                    fn: 'builtins.dec'
                })])], builtins.add, file, {
                    index: 192,
                    fn: 'builtins.add'
                })
            }
        }, true);
        func.frozenscope = Object.assign({}, scope);
        func.frozenscope['fib'] = func;
        func.frozenscope['recall'] = func;
        return func;
    })(scope), 'fib', scope);
    await (async function(__data) {
        var fn = async function(__data) {
            return (await builtins.update_vars(scope, ['fib_of_list'], await builtins.starmap([...__data], await builtins.funcall(['fib'], [scope], builtins.get_symbol, file, {
                index: 242,
                fn: '<get-symbol>'
            }), [], file, {
                index: 242,
                fn: 'fib'
            })))
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })([new builtins.Generator(
        (i, self) => self.data[i],
        [builtins.Decimal('1'), builtins.Decimal('2'), builtins.Decimal('3'), builtins.Decimal('4'), builtins.Decimal('5')],
        self => self.data.length,
    )]);
    await (async function(__data) {
        var fn = async function(__data) {
            return (await builtins.update_vars(scope, ['fib_of_range'], await builtins.starmap([...__data], await builtins.funcall(['fib'], [scope], builtins.get_symbol, file, {
                index: 272,
                fn: '<get-symbol>'
            }), [], file, {
                index: 272,
                fn: 'fib'
            })))
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })([new builtins.Generator(
        (i, self) => self.data.start.add(self.data.step.mul(i)), {
            start: builtins.Decimal('1'),
            end: builtins.Decimal('5'),
            step: builtins.Decimal(builtins.Decimal(builtins.Decimal('1')).lt(builtins.Decimal(builtins.Decimal('5'))) ? 1 : -1)
        },
        self => self.data.start.sub(self.data.end).div(self.data.step).abs().add(1),
    )]);
    await (async function(__data) {
        var fn = async function(__data) {
            return (await builtins.update_vars(scope, ['t'], ...__data))
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })([true]);
    await (async function(__data) {
        var fn = async function(__data) {
            return (await builtins.update_vars(scope, ['f'], ...__data))
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })([false]);
    await (async function(__data) {
        var fn = async function(__data) {
            return (await builtins.update_vars(scope, ['t_and_f'], ...__data))
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })([((await builtins.funcall(['t'], [scope], builtins.get_symbol, file, {
        index: 315,
        fn: '<get-symbol>'
    })) && (await builtins.funcall(['f'], [scope], builtins.get_symbol, file, {
        index: 321,
        fn: '<get-symbol>'
    })))]);
    await (async function(__data) {
        var fn = async function(__data) {
            return (await builtins.update_vars(scope, ['t_or_f'], ...__data))
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })([((await builtins.funcall(['t'], [scope], builtins.get_symbol, file, {
        index: 334,
        fn: '<get-symbol>'
    })) || (await builtins.funcall(['f'], [scope], builtins.get_symbol, file, {
        index: 339,
        fn: '<get-symbol>'
    })))]);
    await (async function(__data) {
        var fn = async function(__data) {
            return (await builtins.update_vars(scope, ['not_t'], ...__data))
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })([(builtins.funcall([await builtins.funcall(['t'], [scope], builtins.get_symbol, file, {
        index: 355,
        fn: '<get-symbol>'
    })], [], builtins.not, file, {
        index: 351,
        fn: '<not>'
    }))]);
    await (async function(__data) {
        var fn = async function(__data) {
            return (await builtins.update_vars(scope, ['not_f'], ...__data))
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })([(builtins.funcall([await builtins.funcall(['f'], [scope], builtins.get_symbol, file, {
        index: 370,
        fn: '<get-symbol>'
    })], [], builtins.not, file, {
        index: 366,
        fn: '<not>'
    }))]);
    await (async function(__data) {
        var fn = async function(__data) {
            return (await builtins.update_vars(scope, ['transform_a'], await builtins.funcall([...__data], [builtins.Decimal('1'), (new builtins.Transform((function(scope) {
                var func = builtins.lazy(async function(i) {
                    var scope = Object.assign({}, func.frozenscope);
                    var args_obj = {};
                    var _arguments = arguments;
                    ['i'].forEach(function(arg, index) {
                        scope[arg] = _arguments[index]
                    });
                    return builtins.funcall([await builtins.funcall(['i'], [scope], builtins.get_symbol, file, {
                        index: 407,
                        fn: '<get-symbol>'
                    })], [builtins.Decimal('2')], builtins.mul, file, {
                        index: 407,
                        fn: 'builtins.mul'
                    })
                }, true);
                func.frozenscope = Object.assign({}, scope);
                func.frozenscope['recall'] = func;
                return func;
            })(scope), 0, false))], await builtins.funcall(['add'], [scope], builtins.get_symbol, file, {
                index: 387,
                fn: '<get-symbol>'
            }), file, {
                index: 387,
                fn: 'add'
            })))
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })([await builtins.funcall(['a'], [scope], builtins.get_symbol, file, {
        index: 382,
        fn: '<get-symbol>'
    })]);
    scope['heavy'] = builtins.lazy(function(...args) {
        return builtins.http_call('http://localhost:3000', 'heavy', args, {});
    }, true);;
    await (async function(__data) {
        var fn = async function(__data) {
            return (await builtins.update_vars(scope, ['a_heavy'], await builtins.funcall([...__data], [], await builtins.funcall(['heavy'], [scope], builtins.get_symbol, file, {
                index: 475,
                fn: '<get-symbol>'
            }), file, {
                index: 475,
                fn: 'heavy'
            })))
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })([await builtins.funcall(['a'], [scope], builtins.get_symbol, file, {
        index: 470,
        fn: '<get-symbol>'
    })]);
    await builtins.setup_ws(ws_connections, 'ws://localhost:3000');
    scope['double'] = await builtins.ws_get(ws_connections['ws://localhost:3000'], 'double');;
    await (async function(__data) {
        var fn = async function(__data) {
            return (await builtins.update_vars(scope, ['a_double'], await builtins.funcall([...__data], [], await builtins.funcall(['double'], [scope], builtins.get_symbol, file, {
                index: 537,
                fn: '<get-symbol>'
            }), file, {
                index: 537,
                fn: 'double'
            })))
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })([await builtins.funcall(['a'], [scope], builtins.get_symbol, file, {
        index: 532,
        fn: '<get-symbol>'
    })]);
    await (async function(__data) {
        var fn = async function(__data) {
            return (await builtins.update_vars(scope, ['hash_map'], ...__data))
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })([{
        'key': 'value'
    }]);
    await (async function(__data) {
        var fn = async function(__data) {
            return (await builtins.update_vars(scope, ['a_pos'], await builtins.funcall([...__data], [builtins.Decimal('3'), (new builtins.AtSign(0))], await builtins.funcall(['pow'], [scope], builtins.get_symbol, file, {
                index: 593,
                fn: '<get-symbol>'
            }), file, {
                index: 593,
                fn: 'pow'
            })))
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })([await builtins.funcall(['a'], [scope], builtins.get_symbol, file, {
        index: 588,
        fn: '<get-symbol>'
    })]);
    await (async function(__data) {
        var fn = async function(__data) {
            return (await builtins.update_vars(scope, ['ee'], await builtins.funcall([...__data], [], await builtins.funcall(['emitter'], [scope], builtins.get_symbol, file, {
                index: 623,
                fn: '<get-symbol>'
            }), file, {
                index: 623,
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
    builtins.define_function((function(scope) {
        var func = builtins.lazy(async function(ee, message) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            ['ee', 'message'].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            return await (async function(__data) {
                var fn = async function(__data) {
                    return await builtins.funcall([...__data], ['message', await builtins.funcall(['message'], [scope], builtins.get_symbol, file, {
                        index: 695,
                        fn: '<get-symbol>'
                    })], await builtins.funcall(['emit'], [scope], builtins.get_symbol, file, {
                        index: 681,
                        fn: '<get-symbol>'
                    }), file, {
                        index: 681,
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
                index: 675,
                fn: '<get-symbol>'
            })])
        }, true);
        func.frozenscope = Object.assign({}, scope);
        func.frozenscope['emit_message'] = func;
        func.frozenscope['recall'] = func;
        return func;
    })(scope), 'emit_message', scope);
    builtins.decorate_function(await builtins.funcall(['eager'], [scope], builtins.get_symbol, file, {
        index: 639,
        fn: '<get-symbol>'
    }), [], 'emit_message', 'default', scope);
    await (async function(__data) {
        var fn = async function(__data) {
            return (await builtins.update_vars(scope, ['br'], await builtins.funcall([...__data], [], await builtins.funcall(['broadcast'], [scope], builtins.get_symbol, file, {
                index: 713,
                fn: '<get-symbol>'
            }), file, {
                index: 713,
                fn: 'broadcast'
            })))
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })(['data']);
    builtins.define_function((function(scope) {
        var func = builtins.lazy(async function(br, message) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            ['br', 'message'].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            return await (async function(__data) {
                var fn = async function(__data) {
                    return (await builtins.update_vars(scope, ['br'], ...__data))
                }
                if (__data[0].is_reactive) {
                    return __data[0].set_listener(function(n) {
                        return fn([n, ...__data.slice(1)])
                    })
                } else {
                    return await fn(__data)
                }
            })([await builtins.funcall(['message'], [scope], builtins.get_symbol, file, {
                index: 772,
                fn: '<get-symbol>'
            })])
        }, true);
        func.frozenscope = Object.assign({}, scope);
        func.frozenscope['broadcast_message'] = func;
        func.frozenscope['recall'] = func;
        return func;
    })(scope), 'broadcast_message', scope);
    builtins.decorate_function(await builtins.funcall(['eager'], [scope], builtins.get_symbol, file, {
        index: 731,
        fn: '<get-symbol>'
    }), [], 'broadcast_message', 'default', scope);
    await (async function(__data) {
        var fn = async function(__data) {
            return (await builtins.update_vars(scope, ['range_slice'], ...__data))
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })([builtins.funcall([new builtins.Generator(
        (i, self) => self.data.start.add(self.data.step.mul(i)), {
            start: builtins.Decimal('0'),
            end: builtins.Decimal('100'),
            step: builtins.Decimal(builtins.Decimal(builtins.Decimal('0')).lt(builtins.Decimal(builtins.Decimal('100'))) ? 1 : -1)
        },
        self => self.data.start.sub(self.data.end).div(self.data.step).abs().add(1),
    )], [
        [builtins.Decimal('50')], 0
    ], builtins.slice, file, {
        index: 794,
        fn: 'builtins.slice'
    })]);
    await (async function(__data) {
        var fn = async function(__data) {
            return (await builtins.update_vars(scope, ['list_slice'], ...__data))
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })([builtins.funcall([new builtins.Generator(
        (i, self) => self.data[i],
        [builtins.Decimal('0'), builtins.Decimal('1'), builtins.Decimal('2'), builtins.Decimal('3'), builtins.Decimal('4'), builtins.Decimal('5')],
        self => self.data.length,
    )], [
        [builtins.Decimal('1')], 0
    ], builtins.slice, file, {
        index: 827,
        fn: 'builtins.slice'
    })]);
    await (async function(__data) {
        var fn = async function(__data) {
            return (await builtins.update_vars(scope, ['eager_map'], await builtins.starmap([...__data], builtins.decorate_function(await builtins.funcall(['eager'], [scope], builtins.get_symbol, file, {
                index: 859,
                fn: '<get-symbol>'
            }), [], (function(scope) {
                var func = builtins.lazy(async function(i) {
                    var scope = Object.assign({}, func.frozenscope);
                    var args_obj = {};
                    var _arguments = arguments;
                    ['i'].forEach(function(arg, index) {
                        scope[arg] = _arguments[index]
                    });
                    return builtins.funcall([await builtins.funcall(['i'], [scope], builtins.get_symbol, file, {
                        index: 874,
                        fn: '<get-symbol>'
                    })], [builtins.Decimal('2')], builtins.mul, file, {
                        index: 874,
                        fn: 'builtins.mul'
                    })
                }, true);
                func.frozenscope = Object.assign({}, scope);
                func.frozenscope['recall'] = func;
                return func;
            })(scope), '', scope), [], file, {
                index: undefined,
                fn: '<anonymous-fn>'
            })))
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })([new builtins.Generator(
        (i, self) => self.data.start.add(self.data.step.mul(i)), {
            start: builtins.Decimal('0'),
            end: builtins.Decimal('4'),
            step: builtins.Decimal(builtins.Decimal(builtins.Decimal('0')).lt(builtins.Decimal(builtins.Decimal('4'))) ? 1 : -1)
        },
        self => self.data.start.sub(self.data.end).div(self.data.step).abs().add(1),
    )]);
    await (async function(__data) {
        var fn = async function(__data) {
            return (await builtins.update_vars(scope, ['lazy_map'], await builtins.starmap([...__data], (function(scope) {
                var func = builtins.lazy(async function(i) {
                    var scope = Object.assign({}, func.frozenscope);
                    var args_obj = {};
                    var _arguments = arguments;
                    ['i'].forEach(function(arg, index) {
                        scope[arg] = _arguments[index]
                    });
                    return builtins.funcall([await builtins.funcall(['i'], [scope], builtins.get_symbol, file, {
                        index: 913,
                        fn: '<get-symbol>'
                    })], [builtins.Decimal('2')], builtins.mul, file, {
                        index: 913,
                        fn: 'builtins.mul'
                    })
                }, true);
                func.frozenscope = Object.assign({}, scope);
                func.frozenscope['recall'] = func;
                return func;
            })(scope), [], file, {
                index: 908,
                fn: '<anonymous-fn>'
            })))
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })([new builtins.Generator(
        (i, self) => self.data.start.add(self.data.step.mul(i)), {
            start: builtins.Decimal('0'),
            end: builtins.Decimal('4'),
            step: builtins.Decimal(builtins.Decimal(builtins.Decimal('0')).lt(builtins.Decimal(builtins.Decimal('4'))) ? 1 : -1)
        },
        self => self.data.start.sub(self.data.end).div(self.data.step).abs().add(1),
    )]);
    await (async function(__data) {
        var fn = async function(__data) {
            return (await builtins.update_vars(scope, ['number'], ...__data))
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })([builtins.Decimal('10')]);
    if (await builtins.funcall([await builtins.funcall([await builtins.funcall(['number'], [scope], builtins.get_symbol, file, {
            index: 949,
            fn: '<get-symbol>'
        })], [builtins.Decimal('8')], builtins.eq, file, {
            index: 949,
            fn: 'builtins.eq'
        })], [], builtins.bool, file, {
            index: 946,
            fn: '<conditional>'
        })) {
        await (async function(__data) {
            var fn = async function(__data) {
                return (await builtins.update_vars(scope, ['number_is'], ...__data))
            }
            if (__data[0].is_reactive) {
                return __data[0].set_listener(function(n) {
                    return fn([n, ...__data.slice(1)])
                })
            } else {
                return await fn(__data)
            }
        })([`=8`])
    } else if (await builtins.funcall([await builtins.funcall([await builtins.funcall(['number'], [scope], builtins.get_symbol, file, {
            index: 986,
            fn: '<get-symbol>'
        })], [builtins.Decimal('10')], builtins.gt, file, {
            index: 986,
            fn: 'builtins.gt'
        })], [], builtins.bool, file, {
            index: 981,
            fn: '<conditional>'
        })) {
        await (async function(__data) {
            var fn = async function(__data) {
                return (await builtins.update_vars(scope, ['number_is'], ...__data))
            }
            if (__data[0].is_reactive) {
                return __data[0].set_listener(function(n) {
                    return fn([n, ...__data.slice(1)])
                })
            } else {
                return await fn(__data)
            }
        })([`>10`])
    } else if (await builtins.funcall([await builtins.funcall([await builtins.funcall(['number'], [scope], builtins.get_symbol, file, {
            index: 1025,
            fn: '<get-symbol>'
        })], [builtins.Decimal('10')], builtins.lt, file, {
            index: 1025,
            fn: 'builtins.lt'
        })], [], builtins.bool, file, {
            index: 1020,
            fn: '<conditional>'
        })) {
        await (async function(__data) {
            var fn = async function(__data) {
                return (await builtins.update_vars(scope, ['number_is'], ...__data))
            }
            if (__data[0].is_reactive) {
                return __data[0].set_listener(function(n) {
                    return fn([n, ...__data.slice(1)])
                })
            } else {
                return await fn(__data)
            }
        })([`<10`])
    } else {
        await (async function(__data) {
            var fn = async function(__data) {
                return (await builtins.update_vars(scope, ['number_is'], ...__data))
            }
            if (__data[0].is_reactive) {
                return __data[0].set_listener(function(n) {
                    return fn([n, ...__data.slice(1)])
                })
            } else {
                return await fn(__data)
            }
        })([`=10`])
    };
    await (async function(__data) {
        var fn = async function(__data) {
            return (await builtins.update_vars(scope, ['other_is'], await builtins.funcall([...__data], [], ((function(scope) {
                var func = builtins.lazy(async function($in) {
                    var scope = Object.assign({}, func.frozenscope);
                    var args_obj = {};
                    var _arguments = arguments;
                    ['$in'].forEach(function(arg, index) {
                        scope[arg] = _arguments[index]
                    });
                    if (await builtins.funcall([await builtins.funcall([await builtins.funcall(['$in'], [scope], builtins.get_symbol, file, {
                            index: undefined,
                            fn: '<get-symbol>'
                        })], [builtins.Decimal('8')], builtins.eq, file, {
                            index: 1096,
                            fn: 'builtins.eq'
                        })], [], builtins.bool, file, {
                            index: 1093,
                            fn: '<conditional>'
                        })) {
                        return `=8`
                    } else if (await builtins.funcall([await builtins.funcall([await builtins.funcall(['$in'], [scope], builtins.get_symbol, file, {
                            index: undefined,
                            fn: '<get-symbol>'
                        })], [builtins.Decimal('10')], builtins.gt, file, {
                            index: 1114,
                            fn: 'builtins.gt'
                        })], [], builtins.bool, file, {
                            index: 1109,
                            fn: '<conditional>'
                        })) {
                        return `>10`
                    } else if (await builtins.funcall([await builtins.funcall([await builtins.funcall(['$in'], [scope], builtins.get_symbol, file, {
                            index: undefined,
                            fn: '<get-symbol>'
                        })], [builtins.Decimal('10')], builtins.lt, file, {
                            index: 1134,
                            fn: 'builtins.lt'
                        })], [], builtins.bool, file, {
                            index: 1129,
                            fn: '<conditional>'
                        })) {
                        return `<10`
                    } else {
                        return `=10`
                    }
                }, true);
                func.frozenscope = Object.assign({}, scope);
                func.frozenscope['recall'] = func;
                return func;
            })(scope)), file, {
                index: 1087,
                fn: '<conditional>'
            })))
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })([builtins.Decimal('10')]);
    await (async function(__data) {
        var fn = async function(__data) {
            return (await builtins.update_vars(scope, ['eight'], ...__data))
        }
        if (__data[0].is_reactive) {
            return __data[0].set_listener(function(n) {
                return fn([n, ...__data.slice(1)])
            })
        } else {
            return await fn(__data)
        }
    })([builtins.Decimal('8')]);
    if (await builtins.funcall([await builtins.funcall([await builtins.funcall(['eight'], [scope], builtins.get_symbol, file, {
            index: 1196,
            fn: '<get-symbol>'
        })], [builtins.Decimal('8')], builtins.eq, file, {
            index: 1196,
            fn: 'builtins.eq'
        })], [], builtins.bool, file, {
            index: 1193,
            fn: '<conditional>'
        })) {
        await (async function(__data) {
            var fn = async function(__data) {
                return (await builtins.update_vars(scope, ['eight_is_eight'], ...__data))
            }
            if (__data[0].is_reactive) {
                return __data[0].set_listener(function(n) {
                    return fn([n, ...__data.slice(1)])
                })
            } else {
                return await fn(__data)
            }
        })([true])
    };
    for (var server in ws_connections) {
        if (ws_connections.hasOwnProperty(server)) {
            if (ws_connections[server].broadcasts == {}) {
                ws_connections[server].socket.close()
            }
        }
    }
    return scope;
};