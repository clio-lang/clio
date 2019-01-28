module.exports = async function(scope, builtins, file) {
    builtins.define_function((function(scope) {
        var func = builtins.lazy(async function(n) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            ['n'].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            if (await builtins.funcall([await builtins.funcall([await builtins.funcall(['n'], [scope], builtins.get_symbol, file, {
                    index: 15,
                    fn: '<get-symbol>'
                })], [builtins.Decimal('2')], builtins.lt, file, {
                    index: 15,
                    fn: 'builtins.lt'
                })], [], builtins.bool, file, {
                    index: 12,
                    fn: '<conditional>'
                })) {
                return await builtins.funcall(['n'], [scope], builtins.get_symbol, file, {
                    index: 22,
                    fn: '<get-symbol>'
                })
            } else {
                return builtins.funcall([await builtins.funcall([builtins.funcall([await builtins.funcall(['n'], [scope], builtins.get_symbol, file, {
                    index: 33,
                    fn: '<get-symbol>'
                })], [builtins.Decimal('1')], builtins.dec, file, {
                    index: 33,
                    fn: 'builtins.dec'
                })], [], await builtins.funcall(['fib'], [scope], builtins.get_symbol, file, {
                    index: 42,
                    fn: '<get-symbol>'
                }), file, {
                    index: 42,
                    fn: 'fib'
                })], [await builtins.funcall([builtins.funcall([await builtins.funcall(['n'], [scope], builtins.get_symbol, file, {
                    index: 50,
                    fn: '<get-symbol>'
                })], [builtins.Decimal('2')], builtins.dec, file, {
                    index: 50,
                    fn: 'builtins.dec'
                })], [], await builtins.funcall(['fib'], [scope], builtins.get_symbol, file, {
                    index: 59,
                    fn: '<get-symbol>'
                }), file, {
                    index: 59,
                    fn: 'fib'
                })], builtins.add, file, {
                    index: 32,
                    fn: 'builtins.add'
                })
            }
        }, true);
        func.frozenscope = Object.assign({}, scope);
        func.frozenscope['fib'] = func;
        func.frozenscope['recall'] = func;
        return func;
    })(scope), 'fib', scope);
    await builtins.funcall([await builtins.funcall([builtins.Decimal('10')], [], await builtins.funcall(['fib'], [scope], builtins.get_symbol, file, {
        index: 71,
        fn: '<get-symbol>'
    }), file, {
        index: 71,
        fn: 'fib'
    })], [], await builtins.funcall(['print'], [scope], builtins.get_symbol, file, {
        index: 78,
        fn: '<get-symbol>'
    }), file, {
        index: 78,
        fn: 'print'
    });
    return scope;
};