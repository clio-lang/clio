"""Protocol validation tests; performance measurements have no pass/fail thresholds."""
import json
import math
import unittest

import run as suite


class ReferenceTests(unittest.TestCase):
    def test_hand_calculated_small_inputs(self):
        self.assertEqual(suite.expected(0, 1), 0.75)
        self.assertEqual(suite.expected(1, 1), -3.75)
        self.assertEqual(suite.expected(2, 1), 0.75)
        self.assertEqual(suite.expected(0, 3), 107 / 64)
        self.assertEqual(suite.expected(1, 3), -78 / 8)


    def test_distributed_matrix_checksum_matches_cubic_reference(self):
        for n in (1, 2, 3, 17, 48):
            a = [i % 17 - 8 for i in range(n*n)]
            b = [i % 13 - 6 for i in range(n*n)]
            reference = sum(a[r*n+k]*b[k*n+c] for r in range(n)
                            for c in range(n) for k in range(n)) / 64
            self.assertEqual(suite.expected(2, n), reference)


class ValidationTests(unittest.TestCase):
    def rows(self):
        return [dict(round=i, ns=10, checksum=1.5) for i in (-2, -1, 0)]

    def verify(self, rows):
        return suite.validate('\n'.join(json.dumps(row) for row in rows), 0, 1, 2, 1)

    def test_complete_batch(self):
        self.assertEqual(len(self.verify(self.rows())), 3)

    def test_bad_warmup_is_not_ignored(self):
        rows = self.rows()
        rows[0]['checksum'] = 123
        with self.assertRaises(ValueError):
            self.verify(rows)

    def test_missing_duplicate_and_reordered_rounds(self):
        for order in ((0, 1), (0, 1, 1, 2), (1, 0, 2)):
            with self.subTest(order=order), self.assertRaises(ValueError):
                rows = self.rows()
                self.verify([rows[i] for i in order])

    def test_nonfinite_or_wrong_result(self):
        for value in (math.nan, math.inf, -math.inf, 1.0):
            with self.subTest(value=value), self.assertRaises(ValueError):
                rows = self.rows()
                rows[2]['checksum'] = value
                self.verify(rows)

    def test_invalid_duration(self):
        for value in (-1, math.nan, math.inf):
            with self.subTest(value=value), self.assertRaises(ValueError):
                rows = self.rows()
                rows[2]['ns'] = value
                self.verify(rows)

    def test_zero_resolution_single_iteration_probe(self):
        rows = self.rows()
        rows[0]['ns'] = 0
        self.assertEqual(self.verify(rows)[0]['ns'], 0)


if __name__ == '__main__':
    unittest.main()
