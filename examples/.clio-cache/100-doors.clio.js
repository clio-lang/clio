module.exports = async function(scope, builtins, file) {
    builtins.define_function((function(scope) {
        var func = builtins.lazy(async function(doors, step) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            ['doors', 'step'].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            if (await builtins.funcall([await builtins.funcall([await builtins.funcall(['step'], [scope], builtins.get_symbol, file, {
                    index: 32,
                    fn: '<get-symbol>'
                })], [builtins.Decimal('100')], builtins.gt, file, {
                    index: 32,
                    fn: 'builtins.gt'
                })], [], builtins.bool, file, {
                    index: 29,
                    fn: '<conditional>'
                })) {
                return await builtins.funcall(['doors'], [scope], builtins.get_symbol, file, {
                    index: 44,
                    fn: '<get-symbol>'
                })
            } else {
                return await builtins.funcall([await builtins.starmap([new builtins.Generator(
                    (i, self) => self.data.start.add(self.data.step.mul(i)), {
                        start: builtins.Decimal('1'),
                        end: builtins.Decimal('100'),
                        step: builtins.Decimal(builtins.Decimal(builtins.Decimal('1')).lt(builtins.Decimal(builtins.Decimal('100'))) ? 1 : -1)
                    },
                    self => self.data.start.sub(self.data.end).div(self.data.step).abs().add(1),
                )], (function(scope) {
                    var func = builtins.lazy(async function(index) {
                        var scope = Object.assign({}, func.frozenscope);
                        var args_obj = {};
                        var _arguments = arguments;
                        ['index'].forEach(function(arg, index) {
                            scope[arg] = _arguments[index]
                        });
                        if (await builtins.funcall([builtins.funcall([await builtins.funcall(['index'], [scope], builtins.get_symbol, file, {
                                index: 106,
                                fn: '<get-symbol>'
                            })], [await builtins.funcall(['step'], [scope], builtins.get_symbol, file, {
                                index: 114,
                                fn: '<get-symbol>'
                            })], builtins.mod, file, {
                                index: 106,
                                fn: 'builtins.mod'
                            })], [], builtins.bool, file, {
                                index: 103,
                                fn: '<conditional>'
                            })) {
                            return builtins.funcall([await builtins.funcall(['doors'], [scope], builtins.get_symbol, file, {
                                index: 120,
                                fn: '<get-symbol>'
                            })], [
                                [builtins.funcall([await builtins.funcall(['index'], [scope], builtins.get_symbol, file, {
                                    index: 127,
                                    fn: '<get-symbol>'
                                })], [builtins.Decimal('1')], builtins.dec, file, {
                                    index: 127,
                                    fn: 'builtins.dec'
                                })], 0
                            ], builtins.slice, file, {
                                index: 125,
                                fn: 'builtins.slice'
                            })
                        } else {
                            return (builtins.funcall([builtins.funcall([await builtins.funcall(['doors'], [scope], builtins.get_symbol, file, {
                                index: 161,
                                fn: '<get-symbol>'
                            })], [
                                [builtins.funcall([await builtins.funcall(['index'], [scope], builtins.get_symbol, file, {
                                    index: 168,
                                    fn: '<get-symbol>'
                                })], [builtins.Decimal('1')], builtins.dec, file, {
                                    index: 168,
                                    fn: 'builtins.dec'
                                })], 0
                            ], builtins.slice, file, {
                                index: 166,
                                fn: 'builtins.slice'
                            })], [], builtins.not, file, {
                                index: 157,
                                fn: '<not>'
                            }))
                        }
                    }, true);
                    func.frozenscope = Object.assign({}, scope);
                    func.frozenscope['recall'] = func;
                    return func;
                })(scope), [], file, {
                    index: 84,
                    fn: '<anonymous-fn>'
                })], [builtins.funcall([await builtins.funcall(['step'], [scope], builtins.get_symbol, file, {
                    index: 202,
                    fn: '<get-symbol>'
                })], [builtins.Decimal('1')], builtins.add, file, {
                    index: 202,
                    fn: 'builtins.add'
                })], await builtins.funcall(['visit-doors'], [scope], builtins.get_symbol, file, {
                    index: 189,
                    fn: '<get-symbol>'
                }), file, {
                    index: 189,
                    fn: 'visit-doors'
                })
            }
        }, true);
        func.frozenscope = Object.assign({}, scope);
        func.frozenscope['visit-doors'] = func;
        func.frozenscope['recall'] = func;
        return func;
    })(scope), 'visit-doors', scope);
    (scope['doors'] = await builtins.funcall([await builtins.starmap([new builtins.Generator(
        (i, self) => self.data.start.add(self.data.step.mul(i)), {
            start: builtins.Decimal('1'),
            end: builtins.Decimal('100'),
            step: builtins.Decimal(builtins.Decimal(builtins.Decimal('1')).lt(builtins.Decimal(builtins.Decimal('100'))) ? 1 : -1)
        },
        self => self.data.start.sub(self.data.end).div(self.data.step).abs().add(1),
    )], (function(scope) {
        var func = builtins.lazy(async function(n) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            ['n'].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            return false
        }, true);
        func.frozenscope = Object.assign({}, scope);
        func.frozenscope['recall'] = func;
        return func;
    })(scope), [], file, {
        index: 226,
        fn: 'undefined'
    })], [builtins.Decimal('1')], await builtins.funcall(['visit-doors'], [scope], builtins.get_symbol, file, {
        index: 238,
        fn: '<get-symbol>'
    }), file, {
        index: 238,
        fn: 'visit-doors'
    }));
    await builtins.starmap([new builtins.Generator(
        (i, self) => self.data.start.add(self.data.step.mul(i)), {
            start: builtins.Decimal('1'),
            end: builtins.Decimal('100'),
            step: builtins.Decimal(builtins.Decimal(builtins.Decimal('1')).lt(builtins.Decimal(builtins.Decimal('100'))) ? 1 : -1)
        },
        self => self.data.start.sub(self.data.end).div(self.data.step).abs().add(1),
    )], builtins.decorate_function(await builtins.funcall(['eager'], [scope], builtins.get_symbol, file, {
        index: 276,
        fn: '<get-symbol>'
    }), [], (function(scope) {
        var func = builtins.lazy(async function(i) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            ['i'].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            return await builtins.funcall([await builtins.funcall([builtins.funcall([await builtins.funcall(['doors'], [scope], builtins.get_symbol, file, {
                index: 291,
                fn: '<get-symbol>'
            })], [
                [builtins.funcall([await builtins.funcall(['i'], [scope], builtins.get_symbol, file, {
                    index: 298,
                    fn: '<get-symbol>'
                })], [builtins.Decimal('1')], builtins.dec, file, {
                    index: 298,
                    fn: 'builtins.dec'
                })], 0
            ], builtins.slice, file, {
                index: 296,
                fn: 'builtins.slice'
            })], [], ((function(scope) {
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
                        })], [true], builtins.eq, file, {
                            index: 316,
                            fn: 'builtins.eq'
                        })], [], builtins.bool, file, {
                            index: 313,
                            fn: '<conditional>'
                        })) {
                        return 'open'
                    } else {
                        return 'closed'
                    }
                }, true);
                func.frozenscope = Object.assign({}, scope);
                func.frozenscope['recall'] = func;
                return func;
            })(scope)), file, {
                index: 289,
                fn: '<conditional>'
            })], ['Door', await builtins.funcall(['i'], [scope], builtins.get_symbol, file, {
                index: 375,
                fn: '<get-symbol>'
            }), 'is', (new builtins.AtSign(0))], await builtins.funcall(['print'], [scope], builtins.get_symbol, file, {
                index: 363,
                fn: '<get-symbol>'
            }), file, {
                index: 363,
                fn: 'print'
            })
        }, true);
        func.frozenscope = Object.assign({}, scope);
        func.frozenscope['recall'] = func;
        return func;
    })(scope), '', scope), [], file, {
        index: undefined,
        fn: '<anonymous-fn>'
    });
    return scope;
};