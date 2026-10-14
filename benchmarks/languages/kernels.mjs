export function fib(n) {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}
export function recurrence(n, value) {
  while (n-- > 0) value = (value * 17 + 23) % 1000003;
  return value;
}
export function dot(a, b, i, total) {
  for (; i < a.length; i++) total += a[i] * b[i];
  return total;
}
