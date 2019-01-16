module.exports = async function(scope, builtins) {
    await builtins.funcall([builtins.Decimal('10')], [], builtins.decorate_function(await builtins.funcall(['eager'], [scope], builtins.get_symbol), [], (function(scope) {
        var func = builtins.lazy(async function(n) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            ['n'].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            if (await builtins.funcall([await builtins.funcall(['n'], [scope], builtins.get_symbol)], [], builtins.bool)) {
                return await builtins.funcall([await builtins.funcall([builtins.funcall([await builtins.funcall(['n'], [scope], builtins.get_symbol)], [builtins.Decimal('1')], builtins.dec)], [], await builtins.funcall(['print'], [scope], builtins.get_symbol))], [], await builtins.funcall(['recall'], [scope], builtins.get_symbol))
            }
        }, true);
        func.frozenscope = Object.assign({}, scope);
        func.frozenscope['recall'] = func;
        return func;
    })(scope), '', scope));
    return scope;
};