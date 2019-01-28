module.exports = async function(scope, builtins, file) {
    await builtins.funcall([builtins.Decimal('10')], [], builtins.decorate_function(await builtins.funcall(['eager'], [scope], builtins.get_symbol, file, {
        index: 8,
        fn: '<get-symbol>'
    }), [], (function(scope) {
        var func = builtins.lazy(async function(n) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            ['n'].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            if (await builtins.funcall([await builtins.funcall(['n'], [scope], builtins.get_symbol, file, {
                    index: 26,
                    fn: '<get-symbol>'
                })], [], builtins.bool, file, {
                    index: 23,
                    fn: '<conditional>'
                })) {
                return await builtins.funcall([await builtins.funcall([builtins.funcall([await builtins.funcall(['n'], [scope], builtins.get_symbol, file, {
                    index: 33,
                    fn: '<get-symbol>'
                })], [builtins.Decimal('1')], builtins.dec, file, {
                    index: 33,
                    fn: 'builtins.dec'
                })], [], await builtins.funcall(['print'], [scope], builtins.get_symbol, file, {
                    index: 42,
                    fn: '<get-symbol>'
                }), file, {
                    index: 42,
                    fn: 'print'
                })], [], await builtins.funcall(['recall'], [scope], builtins.get_symbol, file, {
                    index: 51,
                    fn: '<get-symbol>'
                }), file, {
                    index: 51,
                    fn: 'recall'
                })
            }
        }, true);
        func.frozenscope = Object.assign({}, scope);
        func.frozenscope['recall'] = func;
        return func;
    })(scope), '', scope), file, {
        index: 0,
        fn: '<anonymous-fn>'
    });
    return scope;
};