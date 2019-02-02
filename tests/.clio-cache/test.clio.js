module.exports = async function(scope, builtins, file) {
    builtins.define_function((function(scope) {
        var func = builtins.lazy(async function(n) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            ['n'].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            return builtins.funcall([await builtins.funcall(['n'], [scope], builtins.get_symbol, file, {
                index: 15,
                fn: '<get-symbol>'
            })], [builtins.Decimal('2')], builtins.mul, file, {
                index: 15,
                fn: 'builtins.mul'
            })
        }, true);
        func.frozenscope = Object.assign({}, scope);
        func.frozenscope['double'] = func;
        func.frozenscope['recall'] = func;
        return func;
    })(scope), 'double', scope);
    builtins.define_function((function(scope) {
        var func = builtins.lazy(async function(a, b) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            ['a', 'b'].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            return builtins.funcall([await builtins.funcall(['a'], [scope], builtins.get_symbol, file, {
                index: 36,
                fn: '<get-symbol>'
            })], [await builtins.funcall(['b'], [scope], builtins.get_symbol, file, {
                index: 40,
                fn: '<get-symbol>'
            })], builtins.add, file, {
                index: 36,
                fn: 'builtins.add'
            })
        }, true);
        func.frozenscope = Object.assign({}, scope);
        func.frozenscope['add'] = func;
        func.frozenscope['recall'] = func;
        return func;
    })(scope), 'add', scope);
    builtins.define_function((function(scope) {
        var func = builtins.lazy(async function(n) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            ['n'].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            if (await builtins.funcall([await builtins.funcall([await builtins.funcall(['n'], [scope], builtins.get_symbol, file, {
                    index: 58,
                    fn: '<get-symbol>'
                })], [builtins.Decimal('2')], builtins.lt, file, {
                    index: 58,
                    fn: 'builtins.lt'
                })], [], builtins.bool, file, {
                    index: 55,
                    fn: '<conditional>'
                })) {
                return await builtins.funcall(['n'], [scope], builtins.get_symbol, file, {
                    index: 65,
                    fn: '<get-symbol>'
                })
            } else {
                return builtins.funcall([await builtins.funcall([builtins.funcall([await builtins.funcall(['n'], [scope], builtins.get_symbol, file, {
                    index: 76,
                    fn: '<get-symbol>'
                })], [builtins.Decimal('1')], builtins.dec, file, {
                    index: 76,
                    fn: 'builtins.dec'
                })], [], await builtins.funcall(['fib'], [scope], builtins.get_symbol, file, {
                    index: 86,
                    fn: '<get-symbol>'
                }), file, {
                    index: 86,
                    fn: 'fib'
                })], [await builtins.funcall([builtins.funcall([await builtins.funcall(['n'], [scope], builtins.get_symbol, file, {
                    index: 94,
                    fn: '<get-symbol>'
                })], [builtins.Decimal('2')], builtins.dec, file, {
                    index: 94,
                    fn: 'builtins.dec'
                })], [], await builtins.funcall(['fib'], [scope], builtins.get_symbol, file, {
                    index: 103,
                    fn: '<get-symbol>'
                }), file, {
                    index: 103,
                    fn: 'fib'
                })], builtins.add, file, {
                    index: 75,
                    fn: 'builtins.add'
                })
            }
        }, true);
        func.frozenscope = Object.assign({}, scope);
        func.frozenscope['fib'] = func;
        func.frozenscope['recall'] = func;
        return func;
    })(scope), 'fib', scope);
    (scope['the_range'] = await builtins.starmap([new builtins.Generator(
        (i, self) => self.data.start.add(self.data.step.mul(i)), {
            start: builtins.Decimal('0'),
            end: builtins.Decimal('100'),
            step: builtins.Decimal(builtins.Decimal(builtins.Decimal('0')).lt(builtins.Decimal(builtins.Decimal('100'))) ? 1 : -1)
        },
        self => self.data.start.sub(self.data.end).div(self.data.step).abs().add(1),
    )], await builtins.funcall(['double'], [scope], builtins.get_symbol, file, {
        index: 122,
        fn: '<get-symbol>'
    }), [], file, {
        index: 122,
        fn: 'double'
    }));
    return scope;
};