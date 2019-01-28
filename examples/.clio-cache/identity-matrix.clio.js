module.exports = async function(scope, builtins, file) {
    builtins.define_function((function(scope) {
        var func = builtins.lazy(async function(n) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            ['n'].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            return await builtins.starmap([new builtins.Generator(
                (i, self) => self.data.start.add(self.data.step.mul(i)), {
                    start: builtins.Decimal('0'),
                    end: await builtins.funcall(['n'], [scope], builtins.get_symbol, file, {
                        index: 27,
                        fn: '<get-symbol>'
                    }),
                    step: builtins.Decimal(builtins.Decimal(builtins.Decimal('0')).lt(builtins.Decimal(await builtins.funcall(['n'], [scope], builtins.get_symbol, file, {
                        index: 27,
                        fn: '<get-symbol>'
                    }))) ? 1 : -1)
                },
                self => self.data.start.sub(self.data.end).div(self.data.step).abs().add(1),
            )], (function(scope) {
                var func = builtins.lazy(async function(i) {
                    var scope = Object.assign({}, func.frozenscope);
                    var args_obj = {};
                    var _arguments = arguments;
                    ['i'].forEach(function(arg, index) {
                        scope[arg] = _arguments[index]
                    });
                    return await builtins.starmap([new builtins.Generator(
                        (i, self) => self.data.start.add(self.data.step.mul(i)), {
                            start: builtins.Decimal('0'),
                            end: await builtins.funcall(['n'], [scope], builtins.get_symbol, file, {
                                index: 48,
                                fn: '<get-symbol>'
                            }),
                            step: builtins.Decimal(builtins.Decimal(builtins.Decimal('0')).lt(builtins.Decimal(await builtins.funcall(['n'], [scope], builtins.get_symbol, file, {
                                index: 48,
                                fn: '<get-symbol>'
                            }))) ? 1 : -1)
                        },
                        self => self.data.start.sub(self.data.end).div(self.data.step).abs().add(1),
                    )], ((function(scope) {
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
                                })], [await builtins.funcall(['i'], [scope], builtins.get_symbol, file, {
                                    index: 61,
                                    fn: '<get-symbol>'
                                })], builtins.eq, file, {
                                    index: 59,
                                    fn: 'builtins.eq'
                                })], [], builtins.bool, file, {
                                    index: 56,
                                    fn: '<conditional>'
                                })) {
                                return builtins.Decimal('1')
                            } else {
                                return builtins.Decimal('0')
                            }
                        }, true);
                        func.frozenscope = Object.assign({}, scope);
                        func.frozenscope['recall'] = func;
                        return func;
                    })(scope)), [], file, {
                        index: undefined,
                        fn: 'undefined'
                    })
                }, true);
                func.frozenscope = Object.assign({}, scope);
                func.frozenscope['recall'] = func;
                return func;
            })(scope), [], file, {
                index: 38,
                fn: '<anonymous-fn>'
            })
        }, true);
        func.frozenscope = Object.assign({}, scope);
        func.frozenscope['identity-matrix'] = func;
        func.frozenscope['recall'] = func;
        return func;
    })(scope), 'identity-matrix', scope);
    await builtins.starmap([await builtins.funcall([builtins.Decimal('50')], [], await builtins.funcall(['identity-matrix'], [scope], builtins.get_symbol, file, {
        index: 98,
        fn: '<get-symbol>'
    }), file, {
        index: 98,
        fn: 'identity-matrix'
    })], await builtins.funcall(['print'], [scope], builtins.get_symbol, file, {
        index: 119,
        fn: '<get-symbol>'
    }), [], file, {
        index: 119,
        fn: 'print'
    });
    return scope;
};