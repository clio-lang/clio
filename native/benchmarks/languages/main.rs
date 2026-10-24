use std::{env, hint::black_box, time::Instant};

type Scalar = f64;

fn reduce_pairs(values: &mut [Scalar]) -> Scalar {
    let mut count = values.len();
    while count > 1 {
        for i in 0..count / 2 {
            values[i] = values[i * 2] + values[i * 2 + 1];
        }
        if count % 2 != 0 {
            values[count / 2] = values[count - 1];
        }
        count = (count + 1) / 2;
    }
    if values.is_empty() {
        0.0
    } else {
        values[0]
    }
}

#[inline(never)]
fn kernel(kind: usize, n: usize, a: &[Scalar], b: &[Scalar]) -> Scalar {
    let mut result = vec![0.0; a.len()];
    if kind == 2 {
        let mut products = vec![0.0; n];
        for row in 0..n {
            for col in 0..n {
                for k in 0..n {
                    products[k] = a[row * n + k] * b[k * n + col];
                }
                result[row * n + col] = reduce_pairs(&mut products);
            }
        }
    } else if kind == 1 {
        let scaled: Vec<Scalar> = a.iter().map(|x| x * 3.0).collect();
        for i in 0..a.len() {
            result[i] = scaled[i] + b[i];
        }
    } else {
        for i in 0..a.len() {
            result[i] = a[i] * b[i];
        }
    }
    reduce_pairs(&mut result)
}

fn main() {
    let args: Vec<usize> = env::args()
        .skip(1)
        .map(|x| x.parse().expect("integer argument"))
        .collect();
    assert_eq!(args.len(), 4);
    let (kind, n, iterations, rounds) = (args[0], args[1], args[2], args[3]);
    assert!(kind <= 2 && n > 0 && iterations > 0 && rounds > 0);
    let count = if kind == 2 { n * n } else { n };
    let a: Vec<Scalar> = (0..count)
        .map(|i| ((i % 17) as i32 - 8) as Scalar / 8.0)
        .collect();
    let b: Vec<Scalar> = (0..count)
        .map(|i| ((i % 13) as i32 - 6) as Scalar / 8.0)
        .collect();
    for round in -2..rounds as i32 {
        let mut checksum: f64 = 0.0;
        let start = Instant::now();
        for _ in 0..iterations {
            checksum += black_box(kernel(kind, n, black_box(&a), black_box(&b))) as f64;
        }
        let elapsed = start.elapsed().as_nanos();
        println!(
            "{{\"round\":{},\"ns\":{},\"checksum\":{}}}",
            round, elapsed, checksum
        );
    }
    for i in 0..count {
        assert_eq!(a[i], ((i % 17) as i32 - 8) as Scalar / 8.0);
        assert_eq!(b[i], ((i % 13) as i32 - 6) as Scalar / 8.0);
    }
}
