const CELL = 1.15;
const NEIGHBORS = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,Math.SQRT2],[-1,1,Math.SQRT2],[1,-1,Math.SQRT2],[-1,-1,Math.SQRT2]];

export function createNavigator(colliders, bounds, radius = .43) {
  const floorCount = colliders.reduce((count, c) => c.zone === 'inside' ? Math.max(count, (c.floor ?? 0) + 1) : count, 1);
  const obstacles = {
    outside: [colliders.filter(c => c.zone === 'outside')],
    inside: Array.from({ length: floorCount }, (_, floor) => colliders.filter(c => c.zone === 'inside' && (c.floor ?? 0) === floor)),
  };
  const grids = { outside: [], inside: [] };

  function canStand(x, z, zone, floor = 0) {
    const walls = obstacles[zone]?.[floor];
    if (!walls) return false;
    const b = bounds[zone];
    if (x < b.minX + radius || x > b.maxX - radius || z < b.minZ + radius || z > b.maxZ - radius) return false;
    for (const c of walls) {
      if (x > c.minX - radius && x < c.maxX + radius && z > c.minZ - radius && z < c.maxZ + radius) return false;
    }
    return true;
  }

  function clearSegment(ax, az, bx, bz, zone, floor) {
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / .2);
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      if (!canStand(ax + (bx - ax) * t, az + (bz - az) * t, zone, floor)) return false;
    }
    return true;
  }

  for (const zone of ['outside', 'inside']) {
    const b = bounds[zone];
    const width = Math.ceil((b.maxX - b.minX) / CELL);
    const height = Math.ceil((b.maxZ - b.minZ) / CELL);
    for (let floor = 0; floor < obstacles[zone].length; floor++) {
      const blocked = new Uint8Array(width * height);
      for (let z = 0; z < height; z++) {
        for (let x = 0; x < width; x++) {
          blocked[z * width + x] = Number(!canStand(b.minX + (x + .5) * CELL, b.minZ + (z + .5) * CELL, zone, floor));
        }
      }
      grids[zone][floor] = { ...b, width, height, blocked };
    }
  }

  function pathTo(start, target, zone, range = 1.5, floor = 0) {
    const grid = grids[zone]?.[floor];
    if (!grid) return null;
    if (Math.hypot(start.x - target.x, start.z - target.z) <= range) return [];
    const { width, height, blocked, minX, minZ } = grid;
    const total = width * height;
    const pointX = index => minX + (index % width + .5) * CELL;
    const pointZ = index => minZ + (Math.floor(index / width) + .5) * CELL;
    let first = -1;
    let nearest = Infinity;
    for (let i = 0; i < total; i++) {
      if (blocked[i]) continue;
      const distance = (pointX(i) - start.x) ** 2 + (pointZ(i) - start.z) ** 2;
      if (distance < nearest && clearSegment(start.x, start.z, pointX(i), pointZ(i), zone, floor)) { nearest = distance; first = i; }
    }
    if (first < 0) return null;
    const costs = new Float32Array(total).fill(Infinity);
    const previous = new Int32Array(total).fill(-1);
    const closed = new Uint8Array(total);
    const heap = [];
    const heuristic = index => Math.max(0, Math.hypot(pointX(index) - target.x, pointZ(index) - target.z) - range) / CELL;
    function push(index, score) {
      const node = { index, score };
      heap.push(node);
      let position = heap.length - 1;
      while (position > 0) {
        const parent = (position - 1) >> 1;
        if (heap[parent].score <= score) break;
        heap[position] = heap[parent];
        position = parent;
      }
      heap[position] = node;
    }
    function pop() {
      const root = heap[0];
      const last = heap.pop();
      if (heap.length) {
        let position = 0;
        while (true) {
          let child = position * 2 + 1;
          if (child >= heap.length) break;
          if (child + 1 < heap.length && heap[child + 1].score < heap[child].score) child++;
          if (heap[child].score >= last.score) break;
          heap[position] = heap[child];
          position = child;
        }
        heap[position] = last;
      }
      return root.index;
    }
    costs[first] = 0;
    push(first, heuristic(first));
    while (heap.length) {
      const current = pop();
      if (closed[current]) continue;
      closed[current] = 1;
      const cx = pointX(current);
      const cz = pointZ(current);
      const distance = Math.hypot(cx - target.x, cz - target.z);
      if (distance <= range + CELL) {
        const factor = distance > range ? range / distance : 1;
        const finish = { x: target.x + (cx - target.x) * factor, z: target.z + (cz - target.z) * factor };
        if (clearSegment(cx, cz, finish.x, finish.z, zone, floor)) {
          const result = [];
          for (let node = current; node !== -1; node = previous[node]) result.push({ x: pointX(node), z: pointZ(node) });
          result.reverse();
          if (distance > range) result.push(finish);
          return result;
        }
      }
      const x = current % width;
      const z = Math.floor(current / width);
      for (const [dx, dz, weight] of NEIGHBORS) {
        const nx = x + dx;
        const nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= width || nz >= height) continue;
        const next = nz * width + nx;
        if (blocked[next] || closed[next]) continue;
        if (dx && dz && (blocked[z * width + nx] || blocked[nz * width + x])) continue;
        if (!clearSegment(cx, cz, pointX(next), pointZ(next), zone, floor)) continue;
        const cost = costs[current] + weight;
        if (cost >= costs[next]) continue;
        costs[next] = cost;
        previous[next] = current;
        push(next, cost + heuristic(next));
      }
    }
    return null;
  }

  return { canStand, pathTo };
}
