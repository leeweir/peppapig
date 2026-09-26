import test from 'node:test';
import assert from 'node:assert/strict';
import { createNavigator } from './navigation.js';

const bounds = {
  outside: { minX: -47, maxX: 46, minZ: -43, maxZ: 44 },
  inside: { minX: 110, maxX: 130, minZ: -8, maxZ: 8 },
};

test('walking reaches the picnic interaction edge without crossing its table', () => {
  const navigator = createNavigator([
    { minX: 21.125, maxX: 24.875, minZ: -21.375, maxZ: -18.625, zone: 'outside' },
    { minX: 22.8, maxX: 28.2, minZ: -30.4, maxZ: -26.6, zone: 'outside' },
  ], bounds);
  const start = { x: 20.28, z: -23.73 };
  const table = { x: 23, z: -20 };
  const path = navigator.pathTo(start, table, 'outside', 2.75);
  assert.ok(path, 'a reachable interaction edge must have a walking route');
  const end = path.at(-1);
  assert.ok(Math.hypot(end.x - table.x, end.z - table.z) <= 2.75 + 1e-9);
  let previous = start;
  for (const point of path) {
    const steps = Math.ceil(Math.hypot(point.x - previous.x, point.z - previous.z) / .05);
    for (let step = 0; step <= steps; step++) {
      const t = steps ? step / steps : 0;
      assert.ok(navigator.canStand(previous.x + (point.x - previous.x) * t, previous.z + (point.z - previous.z) * t, 'outside'), 'the entire walking route must stay outside obstacles');
    }
    previous = point;
  }
});

test('an upstairs route ignores downstairs walls but still avoids its own furniture', () => {
  const navigator = createNavigator([
    { minX: 119, maxX: 121, minZ: -8, maxZ: 8, zone: 'inside', floor: 0 },
    { minX: 118, maxX: 122, minZ: -2, maxZ: 2, zone: 'inside', floor: 1 },
  ], bounds);
  const start = { x: 112, z: 0 };
  const destination = { x: 128, z: 0 };
  assert.equal(navigator.pathTo(start, destination, 'inside', 1, 0), null);
  const path = navigator.pathTo(start, destination, 'inside', 1, 1);
  assert.ok(path, 'the upper floor must remain reachable across the downstairs dividing wall');
  const end = path.at(-1);
  assert.ok(Math.hypot(end.x - destination.x, end.z - destination.z) <= 1 + 1e-9);
  let previous = start;
  for (const point of path) {
    const steps = Math.ceil(Math.hypot(point.x - previous.x, point.z - previous.z) / .05);
    for (let step = 0; step <= steps; step++) {
      const t = steps ? step / steps : 0;
      assert.ok(navigator.canStand(previous.x + (point.x - previous.x) * t, previous.z + (point.z - previous.z) * t, 'inside', 1), 'upstairs walking must never pass through upstairs furniture');
    }
    previous = point;
  }
});
