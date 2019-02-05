module.exports = async function(scope, builtins, file) {
    var ws_connections = [];
    builtins.define_function((function(scope) {
        var func = builtins.lazy(async function(n) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            ['n'].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            return builtins.funcall([await builtins.funcall(['n'], [scope], builtins.get_symbol, file, {
                index: 14,
                fn: '<get-symbol>'
            })], [builtins.Decimal('100000000')], builtins.pow, file, {
                index: 14,
                fn: 'builtins.pow'
            })
        }, true);
        func.frozenscope = Object.assign({}, scope);
        func.frozenscope['heavy'] = func;
        func.frozenscope['recall'] = func;
        return func;
    })(scope), 'heavy', scope);
    await (async function(__data) {
        var fn = async function(...__data) {
            return (scope['host'] = [...__data][0])
        }
        if (__data.is_reactive) {
            return __data.set_listener(fn)
        } else {
            return await fn(__data)
        }
    })({
        'exports': new builtins.Generator(
            (i, self) => self.data[i],
            ['heavy'],
            self => self.data.length,
        )
    });
    return scope;
};