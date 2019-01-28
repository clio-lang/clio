module.exports = async function(scope, builtins, file) {
    builtins.define_function((function(scope) {
        var func = builtins.lazy(async function(n) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            ['n'].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            return await builtins.funcall([await builtins.funcall(['n'], [scope], builtins.get_symbol, file, {
                index: 15,
                fn: '<get-symbol>'
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
                        })], [builtins.Decimal('0')], builtins.eq, file, {
                            index: 23,
                            fn: 'builtins.eq'
                        })], [], builtins.bool, file, {
                            index: 20,
                            fn: '<conditional>'
                        })) {
                        return `no more bottles`
                    } else if (await builtins.funcall([await builtins.funcall([await builtins.funcall(['$in'], [scope], builtins.get_symbol, file, {
                            index: undefined,
                            fn: '<get-symbol>'
                        })], [builtins.Decimal('1')], builtins.eq, file, {
                            index: 56,
                            fn: 'builtins.eq'
                        })], [], builtins.bool, file, {
                            index: 51,
                            fn: '<conditional>'
                        })) {
                        return builtins.funcall([await builtins.funcall(['n'], [scope], builtins.get_symbol, file, {
                            index: 64,
                            fn: '<get-symbol>'
                        })], [` bottle`], builtins.add, file, {
                            index: 64,
                            fn: 'builtins.add'
                        })
                    } else {
                        return builtins.funcall([await builtins.funcall(['n'], [scope], builtins.get_symbol, file, {
                            index: 96,
                            fn: '<get-symbol>'
                        })], [` bottles`], builtins.add, file, {
                            index: 96,
                            fn: 'builtins.add'
                        })
                    }
                }, true);
                func.frozenscope = Object.assign({}, scope);
                func.frozenscope['recall'] = func;
                return func;
            })(scope)), file, {
                index: 13,
                fn: '<conditional>'
            })
        }, true);
        func.frozenscope = Object.assign({}, scope);
        func.frozenscope['bottle'] = func;
        func.frozenscope['recall'] = func;
        return func;
    })(scope), 'bottle', scope);
    await builtins.starmap([new builtins.Generator(
        (i, self) => self.data.start.add(self.data.step.mul(i)), {
            start: builtins.Decimal('99'),
            end: builtins.Decimal('0'),
            step: builtins.Decimal(builtins.Decimal(builtins.Decimal('99')).lt(builtins.Decimal(builtins.Decimal('0'))) ? 1 : -1)
        },
        self => self.data.start.sub(self.data.end).div(self.data.step).abs().add(1),
    )], builtins.decorate_function(await builtins.funcall(['eager'], [scope], builtins.get_symbol, file, {
        index: 126,
        fn: '<get-symbol>'
    }), [], (function(scope) {
        var func = builtins.lazy(async function(i) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            ['i'].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            await builtins.funcall([await builtins.funcall([await builtins.funcall(['i'], [scope], builtins.get_symbol, file, {
                index: 141,
                fn: '<get-symbol>'
            })], [], await builtins.funcall(['bottle'], [scope], builtins.get_symbol, file, {
                index: 146,
                fn: '<get-symbol>'
            }), file, {
                index: 146,
                fn: 'bottle'
            })], [(new builtins.Transform((function(scope) {
                var func = builtins.lazy(async function(i) {
                    var scope = Object.assign({}, func.frozenscope);
                    var args_obj = {};
                    var _arguments = arguments;
                    ['i'].forEach(function(arg, index) {
                        scope[arg] = _arguments[index]
                    });
                    return await builtins.funcall([await builtins.funcall(['i'], [scope], builtins.get_symbol, file, {
                        index: 173,
                        fn: '<get-symbol>'
                    })], [], await builtins.funcall(['sentence-case'], [scope], builtins.get_symbol, file, {
                        index: 176,
                        fn: '<get-symbol>'
                    }), file, {
                        index: 176,
                        fn: 'sentence-case'
                    })
                }, true);
                func.frozenscope = Object.assign({}, scope);
                func.frozenscope['recall'] = func;
                return func;
            })(scope), 0, false)), `of beer on the wall,`, (new builtins.AtSign(0)), `of beer.`], await builtins.funcall(['print'], [scope], builtins.get_symbol, file, {
                index: 156,
                fn: '<get-symbol>'
            }), file, {
                index: 156,
                fn: 'print'
            });
            if (await builtins.funcall([await builtins.funcall([await builtins.funcall(['i'], [scope], builtins.get_symbol, file, {
                    index: 232,
                    fn: '<get-symbol>'
                })], [builtins.Decimal('0')], builtins.eq, file, {
                    index: 232,
                    fn: 'builtins.eq'
                })], [], builtins.bool, file, {
                    index: 229,
                    fn: '<conditional>'
                })) {
                return await builtins.funcall([`Go to the store, buy some more, 99 bottles of beer on the wall.`], [], await builtins.funcall(['print'], [scope], builtins.get_symbol, file, {
                    index: 312,
                    fn: '<get-symbol>'
                }), file, {
                    index: 312,
                    fn: 'print'
                })
            } else {
                return await builtins.funcall([await builtins.funcall([builtins.funcall([await builtins.funcall(['i'], [scope], builtins.get_symbol, file, {
                    index: 330,
                    fn: '<get-symbol>'
                })], [builtins.Decimal('1')], builtins.dec, file, {
                    index: 330,
                    fn: 'builtins.dec'
                })], [], await builtins.funcall(['bottle'], [scope], builtins.get_symbol, file, {
                    index: 339,
                    fn: '<get-symbol>'
                }), file, {
                    index: 339,
                    fn: 'bottle'
                })], [`Take one down and pass it around,`, (new builtins.AtSign(0)), `of beer on the wall.
`], await builtins.funcall(['print'], [scope], builtins.get_symbol, file, {
                    index: 349,
                    fn: '<get-symbol>'
                }), file, {
                    index: 349,
                    fn: 'print'
                })
            }
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