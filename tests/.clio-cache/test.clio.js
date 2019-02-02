module.exports = async function(scope, builtins, file) {
    scope['heavy'] = builtins.lazy(function(...args) {
        return builtins.cloud_call('http://localhost:3000', 'heavy', args, {});
    }, true);
    scope['heavy.is_cloud'] = true;
    await builtins.starmap([await builtins.starmap([new builtins.Generator(
        (i, self) => self.data.start.add(self.data.step.mul(i)), {
            start: builtins.Decimal('0'),
            end: builtins.Decimal('10'),
            step: builtins.Decimal(builtins.Decimal(builtins.Decimal('0')).lt(builtins.Decimal(builtins.Decimal('10'))) ? 1 : -1)
        },
        self => self.data.start.sub(self.data.end).div(self.data.step).abs().add(1),
    )], await builtins.funcall(['heavy'], [scope], builtins.get_symbol, file, {
        index: 52,
        fn: '<get-symbol>'
    }), [], file, {
        index: 52,
        fn: 'heavy'
    })], await builtins.funcall(['print'], [scope], builtins.get_symbol, file, {
        index: 63,
        fn: '<get-symbol>'
    }), [], file, {
        index: 63,
        fn: 'print'
    });
    return scope;
};