module.exports = async function(scope, builtins, file) {
    await builtins.funcall([builtins.funcall([new builtins.Generator(
        (i, self) => self.data[i],
        [new builtins.Generator(
            (i, self) => self.data.start.add(self.data.step.mul(i)), {
                start: builtins.Decimal('0'),
                end: builtins.Decimal('100'),
                step: builtins.Decimal('2')
            },
            self => self.data.start.sub(self.data.end).div(self.data.step).abs().add(1),
        ), new builtins.Generator(
            (i, self) => self.data.start.add(self.data.step.mul(i)), {
                start: builtins.Decimal('0'),
                end: builtins.Decimal('100'),
                step: builtins.Decimal('2')
            },
            self => self.data.start.sub(self.data.end).div(self.data.step).abs().add(1),
        ), new builtins.Generator(
            (i, self) => self.data.start.add(self.data.step.mul(i)), {
                start: builtins.Decimal('0'),
                end: builtins.Decimal('100'),
                step: builtins.Decimal('2')
            },
            self => self.data.start.sub(self.data.end).div(self.data.step).abs().add(1),
        )],
        self => self.data.length,
    )], [
        [builtins.Decimal('0'), new builtins.Generator(
            (i, self) => self.data.start.add(self.data.step.mul(i)), {
                start: builtins.Decimal('0'),
                end: builtins.Decimal('10'),
                step: builtins.Decimal('2')
            },
            self => self.data.start.sub(self.data.end).div(self.data.step).abs().add(1),
        )], 0
    ], builtins.slice, file, {
        index: 33,
        fn: 'builtins.slice'
    })], [], await builtins.funcall(['print'], [scope], builtins.get_symbol, file, {
        index: 49,
        fn: '<get-symbol>'
    }), file, {
        index: 49,
        fn: 'print'
    });
    return scope;
};