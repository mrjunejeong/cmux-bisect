import sys, os, unittest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
from sortlib import sort_unique

class TestSortUnique(unittest.TestCase):
    def test_basic(self):
        self.assertEqual(sort_unique([3, 1, 2, 1, 3]), [1, 2, 3])
    def test_empty(self):
        self.assertEqual(sort_unique([]), [])
    def test_already_sorted(self):
        self.assertEqual(sort_unique([1, 2, 3]), [1, 2, 3])

if __name__ == "__main__":
    unittest.main()
