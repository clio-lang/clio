module.exports = async function(scope, builtins) {
    (scope['x'] = await builtins.Decimal('10'));
    scope['hello'] = (function(scope) {
        var func = builtins.lazy(async function(thing) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            ['thing'].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            return await builtins.funcall('hello', [(scope['thing'] || builtins.thing)], (scope['print'] || builtins.print))
        }, true);
        func.frozenscope = Object.assign({}, scope);
        func.frozenscope['hello'] = func;
        func.frozenscope['self'] = func;
        return func;
    })(scope);
    scope['hello'] = (scope['eager'] || builtins.eager)(scope['hello']);;
    return scope;
};