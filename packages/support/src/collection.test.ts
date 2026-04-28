import { describe, it, expect } from 'vitest';
import { collect, Collection } from './collection';

describe('collect / Collection', () => {
  describe('map', () => {
    it('transforms each element', () => {
      expect(
        collect([1, 2, 3])
          .map((x) => x * 2)
          .all(),
      ).toEqual([2, 4, 6]);
    });
  });

  describe('filter', () => {
    it('keeps elements matching the predicate', () => {
      expect(
        collect([1, 2, 3])
          .filter((x) => x > 1)
          .all(),
      ).toEqual([2, 3]);
    });
  });

  describe('first', () => {
    it('returns the first element', () => {
      expect(collect([1, 2, 3]).first()).toBe(1);
    });

    it('returns undefined for an empty collection', () => {
      expect(collect([]).first()).toBeUndefined();
    });

    it('returns the first element matching a predicate', () => {
      expect(collect([1, 2, 3]).first((x) => x > 1)).toBe(2);
    });
  });

  describe('last', () => {
    it('returns the last element', () => {
      expect(collect([1, 2, 3]).last()).toBe(3);
    });

    it('returns undefined for an empty collection', () => {
      expect(collect([]).last()).toBeUndefined();
    });
  });

  describe('sum', () => {
    it('sums a numeric collection', () => {
      expect(collect([1, 2, 3]).sum()).toBe(6);
    });

    it('sums using a callback on objects', () => {
      expect(collect([{ v: 1 }, { v: 2 }]).sum((x) => x.v)).toBe(3);
    });
  });

  describe('avg', () => {
    it('returns the average of a numeric collection', () => {
      expect(collect([1, 2, 3]).avg()).toBe(2);
    });

    it('returns 0 for an empty collection', () => {
      expect(collect([]).avg()).toBe(0);
    });
  });

  describe('sort', () => {
    it('sorts numbers in ascending order', () => {
      expect(collect([3, 1, 2]).sort().all()).toEqual([1, 2, 3]);
    });

    it('accepts a custom comparator', () => {
      expect(
        collect([3, 1, 2])
          .sort((a, b) => b - a)
          .all(),
      ).toEqual([3, 2, 1]);
    });
  });

  describe('pluck', () => {
    it('extracts a property from each object', () => {
      expect(
        collect([{ id: 1 }, { id: 2 }])
          .pluck('id')
          .all(),
      ).toEqual([1, 2]);
    });
  });

  describe('chunk', () => {
    it('splits into chunks of the given size', () => {
      const chunks = collect([1, 2, 3]).chunk(2);
      expect(chunks.all().map((c) => c.all())).toEqual([[1, 2], [3]]);
    });

    it('handles even division', () => {
      const chunks = collect([1, 2, 3, 4]).chunk(2);
      expect(chunks.all().map((c) => c.all())).toEqual([
        [1, 2],
        [3, 4],
      ]);
    });
  });

  describe('unique', () => {
    it('removes duplicate primitives', () => {
      expect(collect([1, 1, 2]).unique().all()).toEqual([1, 2]);
    });

    it('removes duplicates by callback key', () => {
      const result = collect([{ id: 1 }, { id: 1 }, { id: 2 }])
        .unique((x) => x.id)
        .all();
      expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    });
  });

  describe('take', () => {
    it('returns the first n elements', () => {
      expect(collect([1, 2, 3]).take(2).all()).toEqual([1, 2]);
    });

    it('returns all elements when n exceeds length', () => {
      expect(collect([1, 2]).take(10).all()).toEqual([1, 2]);
    });
  });

  describe('skip', () => {
    it('skips the first n elements', () => {
      expect(collect([1, 2, 3]).skip(1).all()).toEqual([2, 3]);
    });

    it('returns empty collection when skipping all', () => {
      expect(collect([1, 2]).skip(5).all()).toEqual([]);
    });
  });

  describe('isEmpty / isNotEmpty', () => {
    it('isEmpty returns true for an empty collection', () => {
      expect(collect([]).isEmpty()).toBe(true);
    });

    it('isEmpty returns false for a non-empty collection', () => {
      expect(collect([1]).isEmpty()).toBe(false);
    });

    it('isNotEmpty returns true for a non-empty collection', () => {
      expect(collect([1]).isNotEmpty()).toBe(true);
    });

    it('isNotEmpty returns false for an empty collection', () => {
      expect(collect([]).isNotEmpty()).toBe(false);
    });
  });

  describe('all / toArray', () => {
    it('all() returns a copy of the underlying array', () => {
      const arr = [1, 2, 3];
      const col = collect(arr);
      expect(col.all()).toEqual(arr);
      expect(col.all()).not.toBe(arr);
    });
  });

  describe('reduce', () => {
    it('reduces to a single value', () => {
      expect(collect([1, 2, 3, 4]).reduce((carry, item) => carry + item, 0)).toBe(10);
    });
  });

  describe('Collection.times', () => {
    it('creates a collection with n elements via factory', () => {
      expect(Collection.times(3, (i) => i * 2).all()).toEqual([2, 4, 6]);
    });
  });

  describe('Collection.range', () => {
    it('creates an inclusive range', () => {
      expect(Collection.range(1, 4).all()).toEqual([1, 2, 3, 4]);
    });
  });
});
