module.exports = async function(scope, builtins) {
    builtins.define_function((function(scope) {
        var func = builtins.lazy(async function(n) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            ['n'].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            return await builtins.starmap([new builtins.Generator(
                (i, self) => self.data.start.add(self.data.step.mul(i)), {
                    start: builtins.Decimal('0'),
                    end: (scope['n'] || builtins['n'] || new builtins.Property('n')),
                    step: builtins.Decimal(builtins.Decimal(builtins.Decimal('0')).lt(builtins.Decimal((scope['n'] || builtins['n'] || new builtins.Property('n')))) ? 1 : -1)
                },
                self => self.data.start.sub(self.data.end).div(self.data.step).abs().add(1),
            )], (function(scope) {
                var func = builtins.lazy(async function(i) {
                    var scope = Object.assign({}, func.frozenscope);
                    var args_obj = {};
                    var _arguments = arguments;
                    ['i'].forEach(function(arg, index) {
                        scope[arg] = _arguments[index]
                    });
                    return await builtins.starmap([new builtins.Generator(
                        (i, self) => self.data.start.add(self.data.step.mul(i)), {
                            start: builtins.Decimal('0'),
                            end: (scope['n'] || builtins['n'] || new builtins.Property('n')),
                            step: builtins.Decimal(builtins.Decimal(builtins.Decimal('0')).lt(builtins.Decimal((scope['n'] || builtins['n'] || new builtins.Property('n')))) ? 1 : -1)
                        },
                        self => self.data.start.sub(self.data.end).div(self.data.step).abs().add(1),
                    )], ((function(scope) {
                        var func = builtins.lazy(async function($in) {
                            var scope = Object.assign({}, func.frozenscope);
                            var args_obj = {};
                            var _arguments = arguments;
                            ['$in'].forEach(function(arg, index) {
                                scope[arg] = _arguments[index]
                            });
                            if (await builtins.funcall([(scope['$in'] || builtins['$in'] || new builtins.Property('$in'))], [(scope['i'] || builtins['i'] || new builtins.Property('i'))], builtins.eq)) {
                                return builtins.Decimal('1')
                            } else {
                                return builtins.Decimal('0')
                            }
                        }, true);
                        func.frozenscope = Object.assign({}, scope);
                        func.frozenscope['self'] = func;
                        return func;
                    })(scope)), [])
                }, true);
                func.frozenscope = Object.assign({}, scope);
                func.frozenscope['self'] = func;
                return func;
            })(scope), [])
        }, true);
        func.frozenscope = Object.assign({}, scope);
        func.frozenscope['identity-matrix'] = func;
        func.frozenscope['self'] = func;
        return func;
    })(scope), 'identity-matrix', scope);
    await builtins.starmap([await builtins.funcall([builtins.Decimal('5')], [], (scope['identity-matrix'] || builtins['identity-matrix'] || new builtins.Property('identity-matrix')))], (scope['print'] || builtins['print'] || new builtins.Property('print')), []);
    return scope;
};