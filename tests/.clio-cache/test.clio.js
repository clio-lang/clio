module.exports = async function(scope, builtins, file) {
    scope['Cat'] = (function(scope) {
        scope = Object.assign({}, scope);
        var init = builtins.define_function((function(scope) {
            var func = builtins.lazy(async function(name, age, self) {
                var scope = Object.assign({}, func.frozenscope);
                var args_obj = {};
                var _arguments = arguments;
                ['name', 'age', 'self'].forEach(function(arg, index) {
                    scope[arg] = _arguments[index]
                });
                (scope['self']['name'] = await builtins.funcall(['name'], [scope], builtins.get_symbol, file, {
                    index: 21,
                    fn: '<get-symbol>'
                }));
                (scope['self']['age'] = await builtins.funcall(['age'], [scope], builtins.get_symbol, file, {
                    index: 41,
                    fn: '<get-symbol>'
                }));
                (scope['self']['type'] = `Cat`);
                return await builtins.funcall(['self'], [scope], builtins.get_symbol, file, {
                    index: undefined,
                    fn: '<get-symbol>'
                })
            }, true);
            func.frozenscope = Object.assign({}, scope);
            func.frozenscope['init'] = func;
            func.frozenscope['recall'] = func;
            return func;
        })(scope), 'init', scope);
        return function(...args) {
            return init(...args, {});
        }
    })(scope);
    (scope['moki'] = await builtins.funcall(['moki', builtins.Decimal('6')], [], await builtins.funcall(['Cat'], [scope], builtins.get_symbol, file, {
        index: 69,
        fn: '<get-symbol>'
    }), file, {
        index: 69,
        fn: 'Cat'
    }));
    (scope['chili'] = await builtins.funcall(['chili', builtins.Decimal('6')], [], await builtins.funcall(['Cat'], [scope], builtins.get_symbol, file, {
        index: 93,
        fn: '<get-symbol>'
    }), file, {
        index: 93,
        fn: 'Cat'
    }));
    (scope['honey'] = await builtins.funcall(['honey', builtins.Decimal('6')], [], await builtins.funcall(['Cat'], [scope], builtins.get_symbol, file, {
        index: 118,
        fn: '<get-symbol>'
    }), file, {
        index: 118,
        fn: 'Cat'
    }));
    (scope['cats'] = new builtins.Generator(
        (i, self) => self.data[i],
        [await builtins.funcall(['moki'], [scope], builtins.get_symbol, file, {
            index: 133,
            fn: '<get-symbol>'
        }), await builtins.funcall(['chili'], [scope], builtins.get_symbol, file, {
            index: 138,
            fn: '<get-symbol>'
        }), await builtins.funcall(['honey'], [scope], builtins.get_symbol, file, {
            index: 144,
            fn: '<get-symbol>'
        })],
        self => self.data.length,
    ));
    scope['Person'] = (function(scope) {
        scope = Object.assign({}, scope);
        var init = builtins.define_function((function(scope) {
            var func = builtins.lazy(async function(name, cats, self) {
                var scope = Object.assign({}, func.frozenscope);
                var args_obj = {};
                var _arguments = arguments;
                ['name', 'cats', 'self'].forEach(function(arg, index) {
                    scope[arg] = _arguments[index]
                });
                (scope['self']['cats'] = await builtins.funcall(['cats'], [scope], builtins.get_symbol, file, {
                    index: 185,
                    fn: '<get-symbol>'
                }));
                (scope['self']['name'] = await builtins.funcall(['name'], [scope], builtins.get_symbol, file, {
                    index: 205,
                    fn: '<get-symbol>'
                }));
                (scope['self']['type'] = `Person`);
                return await builtins.funcall(['self'], [scope], builtins.get_symbol, file, {
                    index: undefined,
                    fn: '<get-symbol>'
                })
            }, true);
            func.frozenscope = Object.assign({}, scope);
            func.frozenscope['init'] = func;
            func.frozenscope['recall'] = func;
            return func;
        })(scope), 'init', scope);
        return function(...args) {
            return init(...args, {});
        }
    })(scope);
    (scope['pouya'] = await builtins.funcall(['pouya', await builtins.funcall(['cats'], [scope], builtins.get_symbol, file, {
        index: 231,
        fn: '<get-symbol>'
    })], [], await builtins.funcall(['Person'], [scope], builtins.get_symbol, file, {
        index: 239,
        fn: '<get-symbol>'
    }), file, {
        index: 239,
        fn: 'Person'
    }));
    await builtins.funcall([(new builtins.lazy_call(async () => (await builtins.value((new builtins.lazy_call(async () => (await builtins.value(builtins.funcall([(new builtins.lazy_call(async () => (await builtins.value((new builtins.lazy_call(async () => (await builtins.value(await builtins.funcall(['pouya'], [scope], builtins.get_symbol, file, {
        index: 255,
        fn: '<get-symbol>'
    })))))))['cats']))], [
        [builtins.Decimal('1')], 0
    ], builtins.slice, file, {
        index: 265,
        fn: 'builtins.slice'
    })))))))['name']))], [], await builtins.funcall(['print'], [scope], builtins.get_symbol, file, {
        index: 277,
        fn: '<get-symbol>'
    }), file, {
        index: 277,
        fn: 'print'
    });
    return scope;
};