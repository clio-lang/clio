module.exports = async function(scope, builtins, file) {
    builtins.define_function((function(scope) {
        var func = builtins.lazy(async function(i) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            ['i'].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            return await builtins.funcall(['meow'], [], await builtins.funcall(['print'], [scope], builtins.get_symbol, file, {
                index: 29,
                fn: '<get-symbol>'
            }), file, {
                index: 29,
                fn: 'print'
            })
        }, true);
        func.frozenscope = Object.assign({}, scope);
        func.frozenscope['meow'] = func;
        func.frozenscope['recall'] = func;
        return func;
    })(scope), 'meow', scope);
    builtins.decorate_function(await builtins.funcall(['eager'], [scope], builtins.get_symbol, file, {
        index: 1,
        fn: '<get-symbol>'
    }), [], 'meow', 'default', scope);
    await builtins.funcall([await builtins.funcall(['meow'], [scope], builtins.get_symbol, file, {
        index: 36,
        fn: '<get-symbol>'
    })], [builtins.Decimal('1000')], await builtins.funcall(['interval'], [scope], builtins.get_symbol, file, {
        index: 44,
        fn: '<get-symbol>'
    }), file, {
        index: 44,
        fn: 'interval'
    });
    return scope;
};