import * as THREE from 'three';

// Reference: S12E02《大房子》, completed house at ~270s.
// https://tv.sohu.com/v/MjAyNjA4MDcvbjYyMDIzNDQxMC5zaHRtbA==.html

export function buildHomeExterior(context) {
  const { exterior, place, box, ball, rod, material, window, registerWindow, collider, interact } = context;
  const colors = {
    wall: 0xf2ee9d,
    block: 0xf8f3ad,
    foundation: 0xe5dfa0,
    roof: 0xeb7857,
    ridge: 0xd86448,
    white: 0xfffbe5,
    glass: 0xa5deeb,
    door: 0xf0ef69,
    doorInset: 0xe7e663,
    handle: 0xb0a94f,
  };
  const house = place(exterior, 0, 0);
  house.name = "Peppa's new house";

  // All heights share the hilltop datum; the plinths continue down into the hill.
  box(house, colors.foundation, 0, -0.42, 0, 9.5, 0.9, 9.4);
  const core = box(house, colors.wall, 0, 4.4, 0, 9.5, 8.8, 9.4);
  box(house, colors.foundation, -1.3, -0.6, 5.6, 6.8, 1.2, 5.8);
  box(house, colors.wall, -1.3, 2.05, 5.6, 6.8, 4.1, 5.8);
  collider(0, 0, 9.5, 9.4);
  collider(-1.3, 5.6, 6.8, 5.8);

  // One shared line geometry per roof size, rather than a separate mesh per tile.
  const tileGeometryCache = new Map();
  const gableGeometryCache = new Map();
  const tileMaterial = new THREE.LineBasicMaterial({
    color: colors.ridge,
    transparent: true,
    opacity: 0.6,
  });

  function roofTileGeometry(span, length) {
    const key = `${span}:${length}`;
    if (tileGeometryCache.has(key)) return tileGeometryCache.get(key);
    const positions = [];
    const rows = Math.max(2, Math.round(span / 0.57));
    const columns = Math.max(2, Math.round(length / 0.61));
    const rowHeight = span / rows;
    const columnWidth = length / columns;
    const line = (x1, z1, x2, z2) => {
      positions.push(x1, 0.076, z1, x2, 0.076, z2);
    };
    for (let row = 0; row <= rows; row++) {
      const x = -span / 2 + row * rowHeight;
      line(x, -length / 2, x, length / 2);
      if (row === rows) continue;
      const stagger = row % 2 ? columnWidth / 2 : 0;
      for (let column = 0; column <= columns; column++) {
        const z = -length / 2 + column * columnWidth + stagger;
        if (z >= length / 2) continue;
        line(x, z, x + rowHeight, z);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    tileGeometryCache.set(key, geometry);
    return geometry;
  }

  // Local ridge runs along Z. The main roof turns 90 degrees, unlike the garage.
  function gabledRoof(parent, width, depth, base, rise, overhang = 0.25, filled = true) {
    if (filled) {
      const key = `${width}:${depth}:${rise}`;
      let geometry = gableGeometryCache.get(key);
      if (!geometry) {
        const triangle = new THREE.Shape();
        triangle.moveTo(-width / 2, 0);
        triangle.lineTo(width / 2, 0);
        triangle.lineTo(0, rise);
        triangle.closePath();
        geometry = new THREE.ExtrudeGeometry(triangle, { depth, bevelEnabled: false });
        gableGeometryCache.set(key, geometry);
      }
      const gable = new THREE.Mesh(geometry, material(colors.wall));
      gable.position.set(0, base, -depth / 2);
      gable.castShadow = true;
      gable.receiveShadow = true;
      parent.add(gable);
    }
    const slope = rise / (width / 2);
    const run = width / 2 + overhang;
    const fall = run * slope;
    const span = Math.hypot(run, fall);
    const length = depth + overhang * 2;
    const tiles = roofTileGeometry(span, length);
    for (const side of [-1, 1]) {
      const panel = place(parent, side * run / 2, 0, base + rise - fall / 2);
      panel.rotation.z = -side * Math.atan(slope);
      box(panel, colors.roof, 0, 0, 0, span, 0.14, length);
      panel.add(new THREE.LineSegments(tiles, tileMaterial));
    }
    rod(parent, colors.ridge,
      [0, base + rise + 0.075, -length / 2],
      [0, base + rise + 0.075, length / 2], 0.085);
  }

  const mainRoof = place(house, 0, 0, 0);
  mainRoof.name = 'Main attic roof, ridge along X';
  mainRoof.rotation.y = Math.PI / 2;
  gabledRoof(mainRoof, 9.4, 9.5, 8.8, 3.6, 0.35);

  const garageRoof = place(house, -1.3, 5.6, 0);
  garageRoof.name = 'Front garage gable';
  gabledRoof(garageRoof, 6.8, 5.8, 4.1, 2.45, 0.22);

  // The pair of yellow projecting dormers is the new house's defining silhouette.
  for (const x of [-2.55, 2.55]) {
    const dormer = place(house, x, 2.4, 0);
    dormer.name = x < 0 ? 'Front left dormer' : 'Front right dormer';
    box(dormer, colors.wall, 0, 10.05, 0, 2.2, 1.9, 3.5);
    gabledRoof(dormer, 2.2, 3.5, 11, 1, 0.12);
    const frame = window(dormer, 0, 10.04, 1.78);
    frame.scale.setScalar(0.76);
  }

  const circleGeometry = new THREE.CircleGeometry(1, 40);
  const ringGeometry = new THREE.TorusGeometry(1, 0.075, 6, 40);
  function roundWindow(parent, x, y, z, radius, side = false) {
    const frame = place(parent, x, z, y);
    if (side) frame.rotation.y = Math.PI / 2;
    frame.scale.setScalar(radius);
    const pane = registerWindow(new THREE.Mesh(circleGeometry, material(colors.glass)));
    frame.add(pane);
    const ring = new THREE.Mesh(ringGeometry, material(colors.white));
    ring.position.z = 0.05;
    frame.add(ring);
    box(frame, colors.white, 0, 0, 0.08, 0.12, 1.96, 0.07);
    box(frame, colors.white, 0, 0, 0.08, 1.96, 0.12, 0.07);
    return frame;
  }
  roundWindow(house, 4.79, 10.3, 0, 0.7, true);
  roundWindow(house, -1.3, 5.35, 8.54, 0.62);

  for (const x of [-3, 0.4]) {
    const frame = window(house, x, 2.1, 8.55);
    frame.scale.setScalar(0.86);
  }
  window(house, 4.79, 6.35, 1.5, true);

  // Sparse, pale masonry marks match the drawing without a noisy brick texture.
  const blockPositions = [];
  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 5; column++) {
      blockPositions.push([4.758, 0.8 + row * 2.08, -3.85 + column * 1.65 + (row % 2) * 0.19, true]);
      blockPositions.push([-4.27 + column * 1.37 + (row % 2) * 0.15, 0.57 + row * 1.02, 8.507, false]);
    }
  }
  const blocks = new THREE.InstancedMesh(core.geometry, material(colors.block), blockPositions.length);
  const transform = new THREE.Object3D();
  for (let index = 0; index < blockPositions.length; index++) {
    const [x, y, z, side] = blockPositions[index];
    transform.position.set(x, y, z);
    transform.scale.set(side ? 0.015 : 0.52, 0.19, side ? 0.52 : 0.015);
    transform.updateMatrix();
    blocks.setMatrixAt(index, transform.matrix);
  }
  blocks.receiveShadow = true;
  house.add(blocks);

  // The garage is entered from its right side: a broad solid yellow door, not glass.
  const garageDoor = place(house, 2.15, 6.55, 0);
  garageDoor.name = 'Yellow garage door';
  garageDoor.rotation.y = Math.PI / 2;
  box(garageDoor, colors.white, 0, 1.86, 0, 3.38, 3.72, 0.13);
  box(garageDoor, colors.door, 0, 1.83, 0.085, 3.13, 3.56, 0.12);
  box(garageDoor, colors.doorInset, 0, 2.46, 0.156, 2.78, 1.91, 0.025);
  box(garageDoor, colors.door, 0, 2.46, 0.178, 2.65, 1.78, 0.025);
  box(garageDoor, colors.doorInset, 0, 0.79, 0.156, 2.78, 1.02, 0.025);
  box(garageDoor, colors.door, 0, 0.79, 0.178, 2.65, 0.9, 0.025);
  box(garageDoor, colors.handle, 0, 0.88, 0.205, 0.34, 0.055, 0.065);

  const door = place(house, 4.79, 1.5, 0);
  door.rotation.y = Math.PI / 2;
  box(door, colors.white, 0, 1.72, 0, 1.65, 3.44, 0.13);
  box(door, colors.door, 0, 1.68, 0.085, 1.39, 3.33, 0.13);
  box(door, colors.white, 0, 2.52, 0.162, 1.09, 1.38, 0.035);
  registerWindow(box(door, colors.glass, 0, 2.52, 0.185, 0.94, 1.22, 0.025));
  rod(door, colors.white, [-0.46, 1.92, 0.211], [0.46, 3.12, 0.211], 0.025);
  rod(door, colors.white, [0.46, 1.92, 0.211], [-0.46, 3.12, 0.211], 0.025);
  box(door, colors.doorInset, 0, 0.75, 0.162, 1.08, 1.16, 0.035);
  box(door, colors.door, 0, 0.75, 0.191, 0.94, 1.02, 0.025);
  ball(door, colors.handle, 0.46, 1.54, 0.23, 0.065);
  box(door, colors.white, 0, -0.055, 0.45, 1.85, 0.22, 1.08);

  const canopy = place(door, 0, 0.47, 0);
  canopy.name = 'Red entrance canopy with white brackets';
  gabledRoof(canopy, 1.95, 1.2, 3.6, 0.78, 0.12, false);
  const canopyFront = 1.075;
  rod(door, colors.white, [-0.88, 3.58, canopyFront], [0.88, 3.58, canopyFront], 0.055);
  rod(door, colors.white, [-0.88, 3.6, canopyFront], [0, 4.3, canopyFront], 0.055);
  rod(door, colors.white, [0.88, 3.6, canopyFront], [0, 4.3, canopyFront], 0.055);
  rod(door, colors.white, [0, 3.59, canopyFront], [0, 4.3, canopyFront], 0.045);
  for (const x of [-0.72, 0.72]) {
    rod(door, colors.white, [x, 3.02, 0.05], [x, 3.58, 0.86], 0.05);
  }
  interact('home-door', 'door', '走进佩奇的新家', 6.6, 1.5, door, 'outside', 2.4);

  return {
    entry: { x: 6.6, z: 1.5 },
    exteriorSpawn: { x: 8, z: 3 },
    approach: { x: 8, z: 5 },
    house,
  };
}
