module.exports = async function(scope, builtins) {
    await builtins.starmap([new builtins.Generator(
        (i, self) => self.data.start.add(self.data.step.mul(i)), {
            start: builtins.Decimal('1'),
            end: builtins.Decimal('100'),
            step: builtins.Decimal(builtins.Decimal(builtins.Decimal('1')).lt(builtins.Decimal(builtins.Decimal('100'))) ? 1 : -1)
        },
        self => self.data.start.sub(self.data.end).div(self.data.step).abs().add(1),
    )], builtins.decorate_function(await builtins.funcall(['eager'], [scope], builtins.get_symbol), [], (function(scope) {
        var func = builtins.lazy(async function(i) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            ['i'].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            return await builtins.funcall([await builtins.funcall([await builtins.funcall([builtins.funcall([await builtins.funcall(['i'], [scope], builtins.get_symbol)], [builtins.Decimal('0.5')], builtins.pow)], [(new builtins.AtSign(0)), (new builtins.Transform((function(scope) {
                var func = builtins.lazy(async function(i) {
                    var scope = Object.assign({}, func.frozenscope);
                    var args_obj = {};
                    var _arguments = arguments;
                    ['i'].forEach(function(arg, index) {
                        scope[arg] = _arguments[index]
                    });
                    return await builtins.funcall([await builtins.funcall(['i'], [scope], builtins.get_symbol)], [], await builtins.funcall(['floor'], [scope], builtins.get_symbol))
                }, true);
                func.frozenscope = Object.assign({}, scope);
                func.frozenscope['self'] = func;
                return func;
            })(scope), 0, false))], await builtins.funcall(['eq'], [scope], builtins.get_symbol))], [], ((function(scope) {
                var func = builtins.lazy(async function($in) {
                    var scope = Object.assign({}, func.frozenscope);
                    var args_obj = {};
                    var _arguments = arguments;
                    ['$in'].forEach(function(arg, index) {
                        scope[arg] = _arguments[index]
                    });
                    if (await builtins.funcall([await builtins.funcall([await builtins.funcall(['$in'], [scope], builtins.get_symbol)], [true], builtins.eq)], [], builtins.bool)) {
                        return 'open'
                    } else {
                        return 'closed'
                    }
                }, true);
                func.frozenscope = Object.assign({}, scope);
                func.frozenscope['self'] = func;
                return func;
            })(scope)))], ['Door', await builtins.funcall(['i'], [scope], builtins.get_symbol), 'is', (new builtins.AtSign(0))], await builtins.funcall(['print'], [scope], builtins.get_symbol))
        }, true);
        func.frozenscope = Object.assign({}, scope);
        func.frozenscope['self'] = func;
        return func;
    })(scope), '', scope), []);
    return scope;
};