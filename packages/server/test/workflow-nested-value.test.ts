import test from 'node:test';
import assert from 'node:assert/strict';
import { getNestedValue } from '../src/services/execution-manager.js';

test('getNestedValue projects object fields across arrays and flattens array field values', () => {
  const data = {
    items: [
      { url: ['https://example.test/blue-1.png', 'https://example.test/blue-2.png'] },
      { url: ['https://example.test/red-1.png', 'https://example.test/red-2.png'] },
    ],
  };

  assert.deepEqual(getNestedValue(data, 'items.url'), [
    'https://example.test/blue-1.png',
    'https://example.test/blue-2.png',
    'https://example.test/red-1.png',
    'https://example.test/red-2.png',
  ]);
});

test('getNestedValue keeps explicit array indexes intact', () => {
  const data = {
    items: [
      { url: ['https://example.test/blue-1.png', 'https://example.test/blue-2.png'] },
      { url: ['https://example.test/red-1.png', 'https://example.test/red-2.png'] },
    ],
  };

  assert.deepEqual(getNestedValue(data, 'items[0].url'), [
    'https://example.test/blue-1.png',
    'https://example.test/blue-2.png',
  ]);
  assert.equal(getNestedValue(data, 'items[1].url[0]'), 'https://example.test/red-1.png');
});
