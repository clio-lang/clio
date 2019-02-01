module.exports = async function(scope, builtins, file) {
    await builtins.funcall([builtins.funcall([new builtins.Generator(
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
    )], [
        [new builtins.Generator(
            (i, self) => self.data.start.add(self.data.step.mul(i)), {
                start: builtins.Decimal('0'),
                end: builtins.Decimal('Infinity'),
                step: builtins.Decimal(builtins.Decimal(builtins.Decimal('0')).lt(builtins.Decimal(builtins.Decimal('Infinity'))) ? 1 : -1)
            },
            self => self.data.start.sub(self.data.end).div(self.data.step).abs().add(1),
        ), new builtins.Generator(
            (i, self) => self.data.start.add(self.data.step.mul(i)), {
                start: builtins.Decimal('1'),
                end: builtins.Decimal('Infinity'),
                step: builtins.Decimal(builtins.Decimal(builtins.Decimal('1')).lt(builtins.Decimal(builtins.Decimal('Infinity'))) ? 1 : -1)
            },
            self => self.data.start.sub(self.data.end).div(self.data.step).abs().add(1),
        )], 0
    ], builtins.slice, file, {
        index: 27,
        fn: 'builtins.slice'
    })], [], await builtins.funcall(['print'], [scope], builtins.get_symbol, file, {
        index: 41,
        fn: '<get-symbol>'
    }), file, {
        index: 41,
        fn: 'print'
    });
    `
[start:end:step]
[start:end]
[start:]
[start::step]
[:end]
[:end:step]
[::]
[:]`;
    return scope;
};