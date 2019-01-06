module.exports = async function(scope, builtins) {
    builtins.define_function((function(scope) {
        var func = builtins.lazy(async function(n) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            ['n'].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            return await builtins.funcall([(scope['n'] || builtins['n'] || new builtins.Property('n'))], [], ((function(scope) {
                var func = builtins.lazy(async function($in) {
                    var scope = Object.assign({}, func.frozenscope);
                    var args_obj = {};
                    var _arguments = arguments;
                    ['$in'].forEach(function(arg, index) {
                        scope[arg] = _arguments[index]
                    });
                    if (await builtins.funcall([(scope['$in'] || builtins['$in'] || new builtins.Property('$in'))], [builtins.Decimal('0')], builtins.eq)) {
                        return `no more bottles`
                    } else if (await builtins.funcall([(scope['$in'] || builtins['$in'] || new builtins.Property('$in'))], [builtins.Decimal('1')], builtins.eq)) {
                        return builtins.funcall([(scope['n'] || builtins['n'] || new builtins.Property('n'))], [` bottle`], builtins.add)
                    } else {
                        return builtins.funcall([(scope['n'] || builtins['n'] || new builtins.Property('n'))], [` bottles`], builtins.add)
                    }
                }, true);
                func.frozenscope = Object.assign({}, scope);
                func.frozenscope['self'] = func;
                return func;
            })(scope)))
        }, true);
        func.frozenscope = Object.assign({}, scope);
        func.frozenscope['bottle'] = func;
        func.frozenscope['self'] = func;
        return func;
    })(scope), 'bottle', scope);
    await builtins.starmap([new builtins.Generator(
        (i, self) => self.data.start.add(self.data.step.mul(i)), {
            start: builtins.Decimal('99'),
            end: builtins.Decimal('0'),
            step: builtins.Decimal('-1')
        },
        self => self.data.start.sub(self.data.end).div(self.data.step).abs().add(1),
    )], builtins.decorate_function((scope['eager'] || builtins['eager'] || new builtins.Property('eager')), [], (function(scope) {
        var func = builtins.lazy(async function(i) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            ['i'].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            await builtins.funcall([await builtins.funcall([(scope['i'] || builtins['i'] || new builtins.Property('i'))], [], (scope['bottle'] || builtins['bottle'] || new builtins.Property('bottle')))], [(new builtins.Transform((function(scope) {
                var func = builtins.lazy(async function(i) {
                    var scope = Object.assign({}, func.frozenscope);
                    var args_obj = {};
                    var _arguments = arguments;
                    ['i'].forEach(function(arg, index) {
                        scope[arg] = _arguments[index]
                    });
                    return await builtins.funcall([(scope['i'] || builtins['i'] || new builtins.Property('i'))], [], (scope['sentence-case'] || builtins['sentence-case'] || new builtins.Property('sentence-case')))
                }, true);
                func.frozenscope = Object.assign({}, scope);
                func.frozenscope['self'] = func;
                return func;
            })(scope), 0, false)), `of beer on the wall,`, (new builtins.AtSign(0)), `of beer.`], (scope['print'] || builtins['print'] || new builtins.Property('print')));
            if (await builtins.funcall([(scope['i'] || builtins['i'] || new builtins.Property('i'))], [builtins.Decimal('0')], builtins.eq)) {
                return await builtins.funcall([`Go to the store, buy some more, 99 bottles of beer on the wall.`], [], (scope['print'] || builtins['print'] || new builtins.Property('print')))
            } else {
                return await builtins.funcall([await builtins.funcall([builtins.funcall([(scope['i'] || builtins['i'] || new builtins.Property('i'))], [builtins.Decimal('1')], builtins.dec)], [], (scope['bottle'] || builtins['bottle'] || new builtins.Property('bottle')))], [`Take one down and pass it around,`, (new builtins.AtSign(0)), `of beer on the wall.
`], (scope['print'] || builtins['print'] || new builtins.Property('print')))
            }
        }, true);
        func.frozenscope = Object.assign({}, scope);
        func.frozenscope['self'] = func;
        return func;
    })(scope), '', scope), []);
    return scope;
};