module.exports = async function(scope, builtins, file) {
    builtins.define_function((function(scope) {
        var func = builtins.lazy(async function(list, index) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            ['list', 'index'].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            return builtins.funcall([await builtins.funcall(['list'], [scope], builtins.get_symbol, file, {
                index: 23,
                fn: '<get-symbol>'
            })], [
                [await builtins.funcall(['index'], [scope], builtins.get_symbol, file, {
                    index: 28,
                    fn: '<get-symbol>'
                })], 0
            ], builtins.slice, file, {
                index: 27,
                fn: 'builtins.slice'
            })
        }, true);
        func.frozenscope = Object.assign({}, scope);
        func.frozenscope['pluck'] = func;
        func.frozenscope['recall'] = func;
        return func;
    })(scope), 'pluck', scope);
    builtins.define_function((function(scope) {
        var func = builtins.lazy(async function(list, index) {
            var scope = Object.assign({}, func.frozenscope);
            var args_obj = {};
            var _arguments = arguments;
            ['list', 'index'].forEach(function(arg, index) {
                scope[arg] = _arguments[index]
            });
            return await builtins.funcall([await builtins.funcall(['list'], [scope], builtins.get_symbol, file, {
                index: 60,
                fn: '<get-symbol>'
            })], [await builtins.funcall(['index'], [scope], builtins.get_symbol, file, {
                index: 74,
                fn: '<get-symbol>'
            })], await builtins.funcall(['pluck'], [scope], builtins.get_symbol, file, {
                index: 68,
                fn: '<get-symbol>'
            }), file, {
                index: 68,
                fn: 'pluck'
            })
        }, true);
        func.frozenscope = Object.assign({}, scope);
        func.frozenscope['pluck2'] = func;
        func.frozenscope['recall'] = func;
        return func;
    })(scope), 'pluck2', scope);
    await builtins.funcall([await builtins.starmap([new builtins.Generator(
        (i, self) => self.data[i],
        [new builtins.Generator(
            (i, self) => self.data[i],
            [builtins.Decimal('1'), builtins.Decimal('2'), builtins.Decimal('3')],
            self => self.data.length,
        ), new builtins.Generator(
            (i, self) => self.data[i],
            [builtins.Decimal('4'), builtins.Decimal('5'), builtins.Decimal('6')],
            self => self.data.length,
        ), new builtins.Generator(
            (i, self) => self.data[i],
            [builtins.Decimal('7'), builtins.Decimal('8'), builtins.Decimal('9')],
            self => self.data.length,
        )],
        self => self.data.length,
    )], await builtins.funcall(['pluck2'], [scope], builtins.get_symbol, file, {
        index: 114,
        fn: '<get-symbol>'
    }), [builtins.Decimal('1')], file, {
        index: 114,
        fn: 'pluck2'
    })], [], await builtins.funcall(['print'], [scope], builtins.get_symbol, file, {
        index: 126,
        fn: '<get-symbol>'
    }), file, {
        index: 126,
        fn: 'print'
    });
    (scope['x'] = builtins.Decimal('10'));
    if (await builtins.funcall([await builtins.funcall([await builtins.funcall(['x'], [scope], builtins.get_symbol, file, {
            index: 144,
            fn: '<get-symbol>'
        })], [builtins.Decimal('11')], builtins.gt, file, {
            index: 144,
            fn: 'builtins.gt'
        })], [], builtins.bool, file, {
            index: 141,
            fn: '<conditional>'
        })) {
        await builtins.funcall(['YES'], [], await builtins.funcall(['print'], [scope], builtins.get_symbol, file, {
            index: 162,
            fn: '<get-symbol>'
        }), file, {
            index: 162,
            fn: 'print'
        })
    } else {
        await builtins.funcall(['NO'], [], await builtins.funcall(['print'], [scope], builtins.get_symbol, file, {
            index: 183,
            fn: '<get-symbol>'
        }), file, {
            index: 183,
            fn: 'print'
        })
    };
    return scope;
};