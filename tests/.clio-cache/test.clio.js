module.exports = async function(scope, builtins) {
    (scope['a'] = new builtins.Generator(
        (i, self) => self.data[i],
        [builtins.Decimal('1'), builtins.Decimal('2'), builtins.Decimal('3'), builtins.Decimal('4'), builtins.Decimal('5'), builtins.Decimal('6'), builtins.Decimal('7'), builtins.Decimal('8'), builtins.Decimal('9'), builtins.Decimal('10')],
        self => self.data.length,
    ));
    await builtins.starmap([await builtins.funcall([(scope['a'] || builtins['a'] || new builtins.Property('a'))], [(new builtins.AtSign(0)), (new builtins.Transform((function(scope) {
        var func = builtins.lazy(async function(n) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            ['n'].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            return await builtins.funcall([(scope['n'] || builtins['n'] || new builtins.Property('n'))], [builtins.Decimal('5')], builtins.gt)
        }, true);
        func.frozenscope = Object.assign({}, scope);
        func.frozenscope['self'] = func;
        return func;
    })(scope), 0, true))], (scope['filter'] || builtins['filter'] || new builtins.Property('filter')))], (scope['print'] || builtins['print'] || new builtins.Property('print')), []);
    return scope;
};