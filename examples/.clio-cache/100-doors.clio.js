module.exports = async function(scope, builtins) {
    builtins.define_function((function(scope) {
        var func = builtins.lazy(async function(doors, step) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            ['doors', 'step'].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            if (await builtins.funcall([await builtins.funcall([await builtins.funcall(['step'], [scope], builtins.get_symbol)], [builtins.Decimal('100')], builtins.gt)], [], builtins.bool)) {
                return await builtins.funcall(['doors'], [scope], builtins.get_symbol)
            } else {
                return await builtins.funcall([await builtins.starmap([new builtins.Generator(
                    (i, self) => self.data.start.add(self.data.step.mul(i)), {
                        start: builtins.Decimal('1'),
                        end: builtins.Decimal('100'),
                        step: builtins.Decimal(builtins.Decimal(builtins.Decimal('1')).lt(builtins.Decimal(builtins.Decimal('100'))) ? 1 : -1)
                    },
                    self => self.data.start.sub(self.data.end).div(self.data.step).abs().add(1),
                )], (function(scope) {
                    var func = builtins.lazy(async function(index) {
                        var scope = Object.assign({}, func.frozenscope);
                        var args_obj = {};
                        var _arguments = arguments;
                        ['index'].forEach(function(arg, index) {
                            scope[arg] = _arguments[index]
                        });
                        if (await builtins.funcall([builtins.funcall([await builtins.funcall(['index'], [scope], builtins.get_symbol)], [await builtins.funcall(['step'], [scope], builtins.get_symbol)], builtins.mod)], [], builtins.bool)) {
                            return builtins.funcall([await builtins.funcall(['doors'], [scope], builtins.get_symbol)], [
                                [builtins.funcall([await builtins.funcall(['index'], [scope], builtins.get_symbol)], [builtins.Decimal('1')], builtins.dec)], 0
                            ], builtins.slice)
                        } else {
                            return (builtins.funcall([builtins.funcall([await builtins.funcall(['doors'], [scope], builtins.get_symbol)], [
                                [builtins.funcall([await builtins.funcall(['index'], [scope], builtins.get_symbol)], [builtins.Decimal('1')], builtins.dec)], 0
                            ], builtins.slice)], [], builtins.not))
                        }
                    }, true);
                    func.frozenscope = Object.assign({}, scope);
                    func.frozenscope['self'] = func;
                    return func;
                })(scope), [])], [builtins.funcall([await builtins.funcall(['step'], [scope], builtins.get_symbol)], [builtins.Decimal('1')], builtins.add)], await builtins.funcall(['visit-doors'], [scope], builtins.get_symbol))
            }
        }, true);
        func.frozenscope = Object.assign({}, scope);
        func.frozenscope['visit-doors'] = func;
        func.frozenscope['self'] = func;
        return func;
    })(scope), 'visit-doors', scope);
    (scope['doors'] = await builtins.funcall([await builtins.starmap([new builtins.Generator(
        (i, self) => self.data.start.add(self.data.step.mul(i)), {
            start: builtins.Decimal('1'),
            end: builtins.Decimal('100'),
            step: builtins.Decimal(builtins.Decimal(builtins.Decimal('1')).lt(builtins.Decimal(builtins.Decimal('100'))) ? 1 : -1)
        },
        self => self.data.start.sub(self.data.end).div(self.data.step).abs().add(1),
    )], (function(scope) {
        var func = builtins.lazy(async function(n) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            ['n'].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            return false
        }, true);
        func.frozenscope = Object.assign({}, scope);
        func.frozenscope['self'] = func;
        return func;
    })(scope), [])], [builtins.Decimal('1')], await builtins.funcall(['visit-doors'], [scope], builtins.get_symbol)));
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
            return await builtins.funcall([await builtins.funcall([builtins.funcall([await builtins.funcall(['doors'], [scope], builtins.get_symbol)], [
                [builtins.funcall([await builtins.funcall(['i'], [scope], builtins.get_symbol)], [builtins.Decimal('1')], builtins.dec)], 0
            ], builtins.slice)], [], ((function(scope) {
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