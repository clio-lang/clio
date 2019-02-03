module.exports = async function(scope, builtins, file) {
    (scope['x'] = builtins.Decimal('10'));
    builtins.define_function((function(scope) {
        var func = builtins.lazy(async function(thing) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            ['thing'].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            return await builtins.funcall(['hello'], [await builtins.funcall(['thing'], [scope], builtins.get_symbol, file, {
                index: 43,
                fn: '<get-symbol>'
            })], await builtins.funcall(['print'], [scope], builtins.get_symbol, file, {
                index: 37,
                fn: '<get-symbol>'
            }), file, {
                index: 37,
                fn: 'print'
            })
        }, true);
        func.frozenscope = Object.assign({}, scope);
        func.frozenscope['hello'] = func;
        func.frozenscope['recall'] = func;
        return func;
    })(scope), 'hello', scope);
    return scope;
};