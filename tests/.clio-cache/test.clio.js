module.exports = async function(scope, builtins) {
    await builtins.funcall([builtins.slice(new builtins.Generator(
        (i, self) => self.data[i],
        [builtins.Decimal('1'), builtins.Decimal('2'), builtins.Decimal('3'), builtins.Decimal('4'), builtins.Decimal('5'), builtins.Decimal('6'), builtins.Decimal('7'), builtins.Decimal('8'), builtins.Decimal('9'), builtins.Decimal('10')],
        self => self.data.length,
    ), [new builtins.Generator(
        (i, self) => self.data[i],
        [builtins.Decimal('2'), builtins.Decimal('3'), builtins.Decimal('4'), builtins.Decimal('5'), builtins.Decimal('6')],
        self => self.data.length,
    )], 0)], [], (scope['print'] || builtins['print'] || new builtins.Property('print')));
    await builtins.funcall([builtins.slice(new builtins.Generator(
        (i, self) => self.data[i],
        [builtins.Decimal('1'), builtins.Decimal('2'), builtins.Decimal('3'), builtins.Decimal('4'), builtins.Decimal('5'), builtins.Decimal('6'), builtins.Decimal('7'), builtins.Decimal('8'), builtins.Decimal('9'), builtins.Decimal('10')],
        self => self.data.length,
    ), [new builtins.Generator(
        (i, self) => self.data.start.add(self.data.step.mul(i)), {
            start: builtins.Decimal('2'),
            end: builtins.Decimal('7'),
            step: builtins.Decimal('1')
        },
        self => self.data.start.sub(self.data.end).div(self.data.step).abs().add(1),
    )], 0)], [], (scope['print'] || builtins['print'] || new builtins.Property('print')));
    await builtins.funcall([builtins.slice(new builtins.Generator(
        (i, self) => self.data[i],
        [builtins.Decimal('1'), builtins.Decimal('2'), builtins.Decimal('3'), builtins.Decimal('4'), builtins.Decimal('5'), builtins.Decimal('6'), builtins.Decimal('7'), builtins.Decimal('8'), builtins.Decimal('9'), builtins.Decimal('10')],
        self => self.data.length,
    ), [new builtins.Generator(
        (i, self) => self.data.start.add(self.data.step.mul(i)), {
            start: builtins.Decimal('2'),
            end: builtins.Decimal('7'),
            step: builtins.Decimal('2')
        },
        self => self.data.start.sub(self.data.end).div(self.data.step).abs().add(1),
    )], 0)], [], (scope['print'] || builtins['print'] || new builtins.Property('print')));
    await builtins.funcall([builtins.slice(new builtins.Generator(
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
    ), [new builtins.Generator(
        (i, self) => self.data[i],
        [builtins.Decimal('0'), builtins.Decimal('2')],
        self => self.data.length,
    ), new builtins.Generator(
        (i, self) => self.data[i],
        [builtins.Decimal('0'), builtins.Decimal('1')],
        self => self.data.length,
    )], 0)], [], (scope['print'] || builtins['print'] || new builtins.Property('print')));
    await builtins.funcall([builtins.funcall([new builtins.Generator(
        (i, self) => self.data[i],
        [builtins.Decimal('1'), builtins.Decimal('2'), builtins.Decimal('3')],
        self => self.data.length,
    )], [builtins.Decimal('2')], builtins.mul)], [], (scope['print'] || builtins['print'] || new builtins.Property('print')));
    return scope;
};