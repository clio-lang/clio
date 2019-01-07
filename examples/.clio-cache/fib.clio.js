module.exports = async function(scope, builtins) {
    builtins.define_function((function(scope) {
        var func = builtins.lazy(async function(n) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            ['n'].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            if (await builtins.funcall([(scope['n'] || builtins['n'] || new builtins.Property('n'))], [builtins.Decimal('2')], builtins.lt)) {
                return (scope['n'] || builtins['n'] || new builtins.Property('n'))
            } else {
                return builtins.funcall([await builtins.funcall([builtins.funcall([(scope['n'] || builtins['n'] || new builtins.Property('n'))], [builtins.Decimal('1')], builtins.dec)], [], (scope['fib'] || builtins['fib'] || new builtins.Property('fib')))], [await builtins.funcall([builtins.funcall([(scope['n'] || builtins['n'] || new builtins.Property('n'))], [builtins.Decimal('2')], builtins.dec)], [], (scope['fib'] || builtins['fib'] || new builtins.Property('fib')))], builtins.add)
            }
        }, true);
        func.frozenscope = Object.assign({}, scope);
        func.frozenscope['fib'] = func;
        func.frozenscope['self'] = func;
        return func;
    })(scope), 'fib', scope);
    await builtins.starmap([await builtins.starmap([new builtins.Generator(
        (i, self) => self.data.start.add(self.data.step.mul(i)), {
            start: builtins.Decimal('0'),
            end: builtins.Decimal('100'),
            step: builtins.Decimal('1')
        },
        self => self.data.start.sub(self.data.end).div(self.data.step).abs().add(1),
    )], (scope['fib'] || builtins['fib'] || new builtins.Property('fib')), [])], (scope['print'] || builtins['print'] || new builtins.Property('print')), []);
    return scope;
};