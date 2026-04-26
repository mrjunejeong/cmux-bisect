"""Buggy sort_unique implementation."""

def sort_unique(items):
    """Sort items ascending and remove duplicates."""
    # Bug 1: returns reverse-sorted
    # Bug 2: doesn't dedupe
    return sorted(items, reverse=True)
