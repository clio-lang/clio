"""Standard-library Python baseline; no NumPy, BLAS, JIT or subprocess in timing."""
import json
import sys
import time


def reduce_pairs(values):
    count = len(values)
    while count > 1:
        for i in range(count // 2):
            values[i] = values[i * 2] + values[i * 2 + 1]
        if count % 2:
            values[count // 2] = values[count - 1]
        count = (count + 1) // 2
    return values[0] if values else 0.0


def kernel(kind, n, a, b):
    if kind == 2:
        result = [0.0] * (n * n)
        products = [0.0] * n
        for row in range(n):
            for col in range(n):
                for k in range(n):
                    products[k] = a[row * n + k] * b[k * n + col]
                result[row * n + col] = reduce_pairs(products)
    elif kind == 1:
        scaled = [value * 3.0 for value in a]
        result = [x + y for x, y in zip(scaled, b)]
    else:
        result = [x * y for x, y in zip(a, b)]
    return reduce_pairs(result)


def main():
    kind, n, iterations, rounds = map(int, sys.argv[1:])
    assert kind in (0, 1, 2) and n > 0 and iterations > 0 and rounds > 0
    count = n * n if kind == 2 else n
    a = [(i % 17 - 8) / 8.0 for i in range(count)]
    b = [(i % 13 - 6) / 8.0 for i in range(count)]
    for round_index in range(-2, rounds):
        checksum = 0.0
        start = time.perf_counter_ns()
        for _ in range(iterations):
            checksum += kernel(kind, n, a, b)
        elapsed = time.perf_counter_ns() - start
        print(json.dumps(dict(round=round_index, ns=elapsed, checksum=checksum)))
    assert a == [(i % 17 - 8) / 8.0 for i in range(count)]
    assert b == [(i % 13 - 6) / 8.0 for i in range(count)]


if __name__ == '__main__':
    main()
