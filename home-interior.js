import * as THREE from 'three';

// Visual references: S12E03《装饰》, garage ~60s, nursery ~75s, bedrooms ~270/275s.
// Room colors and furnishings follow the episode; floor plan and scale are adapted for walking.

const PALETTE = {
  cream: 0xfff4c4, yellow: 0xffed72, mint: 0xa3efd0, blue: 0x92d7ed,
  lavender: 0xb0a0e9, purple: 0x9a6bd4, pink: 0xf7aed1, wood: 0xd5ae70,
  white: 0xfffbed, dark: 0x405a67, green: 0x68c65e,
};

export function buildHomeInterior(context) {
  const { interior, place, box, ball, cylinder, rod, material, window, collider, interact } = context;
  const C = PALETTE;
  const floors = [
    { name: '一楼 · 客厅与车库', spawn: { x: 120, z: 7 } },
    { name: '二楼 · 家人的房间', spawn: { x: 128, z: 1 } },
    { name: '阁楼 · 佩奇和乔治的房间', spawn: { x: 128, z: 1 } },
  ];
  const triangle = new THREE.Shape();
  triangle.moveTo(-0.5, 0.4);
  triangle.lineTo(0.5, 0.4);
  triangle.lineTo(0, -0.5);
  triangle.closePath();
  const triangleGeometry = new THREE.ShapeGeometry(triangle);
  const star = new THREE.Shape();
  for (let point = 0; point < 10; point++) {
    const angle = Math.PI / 2 + point * Math.PI / 5;
    const radius = point % 2 ? 0.43 : 1;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (point === 0) star.moveTo(x, y);
    else star.lineTo(x, y);
  }
  star.closePath();
  const starGeometry = new THREE.ShapeGeometry(star);
  const ringGeometry = new THREE.TorusGeometry(1, 0.09, 6, 24);
  const discGeometry = new THREE.CircleGeometry(1, 32);
  const planeGeometry = new THREE.PlaneGeometry(1, 1);

  function solid(floor, color, x, y, z, width, height, depth) {
    const result = box(floors[floor].group, color, x, y, z, width, height, depth);
    collider(120 + x, z, width, depth, 'inside', floor);
    return result;
  }
  function footprint(floor, x, z, width, depth) {
    collider(120 + x, z, width, depth, 'inside', floor);
  }
  function flat(parent, geometry, color, x, y, z, scaleX, scaleY = scaleX) {
    const result = new THREE.Mesh(geometry, material(color, { side: THREE.DoubleSide }));
    result.position.set(x, y, z);
    result.scale.set(scaleX, scaleY, 1);
    parent.add(result);
    return result;
  }
  function rug(parent, x, z, rx, rz, colors) {
    for (let index = 0; index < colors.length; index++) {
      const inset = 1 - index * 0.16;
      const result = cylinder(parent, colors[index], x, 0.025 + index * 0.013, z, 1, 0.018);
      result.scale.x = rx * inset;
      result.scale.z = rz * inset;
    }
  }
  function mural(parent, x, y, z, width, height, paint, rotation = 0) {
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    paint(ctx, canvas.width, canvas.height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.Mesh(planeGeometry, new THREE.MeshBasicMaterial({ map: texture, transparent: true }));
    face.position.set(x, y, z);
    face.scale.set(width, height, 1);
    face.rotation.y = rotation;
    parent.add(face);
  }
  function cloud(ctx, x, y, radius, color = '#fffdf3') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y + radius * 0.25, radius * 1.45, radius * 0.53, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const [dx, dy, scale] of [[-0.7, 0, 0.6], [0, -0.35, 0.78], [0.75, -0.03, 0.58]]) {
      ctx.beginPath();
      ctx.arc(x + dx * radius, y + dy * radius, radius * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function curtain(parent, x, z, color, y = 2.15) {
    window(parent, x, y, z);
    rod(parent, C.wood, [x - 1.45, y + 1.2, z + 0.13], [x + 1.45, y + 1.2, z + 0.13], 0.045);
    for (const side of [-1, 1]) {
      box(parent, color, x + side * 1.13, y, z + 0.24, 0.43, 2.2, 0.12);
      for (let mark = 0; mark < 4; mark++) {
        ball(parent, C.cream, x + side * 1.13, y - 0.75 + mark * 0.48, z + 0.315, 0.055, 0.09, 0.015);
      }
    }
  }
  function doorway(parent, x, z, width = 3) {
    for (const side of [-1, 1]) box(parent, C.yellow, x + side * width / 2, 1.45, z, 0.12, 2.9, 0.22);
    box(parent, C.yellow, x, 2.92, z, width + 0.12, 0.12, 0.22);
  }
  function dresser(floor, x, z, color, width = 2.3) {
    const group = place(floors[floor].group, x, z, 0);
    box(group, color, 0, 0.82, 0, width, 1.64, 0.9);
    box(group, C.white, 0, 1.69, 0, width + 0.14, 0.12, 1.02);
    for (let row = 0; row < 3; row++) {
      box(group, color, 0, 0.3 + row * 0.47, 0.48, width - 0.18, 0.4, 0.06);
      for (const side of [-1, 1]) ball(group, C.purple, side * width * 0.23, 0.3 + row * 0.47, 0.54, 0.06);
    }
    footprint(floor, x, z, width + 0.15, 1.03);
    return group;
  }
  function bookcase(floor, x, z, color, width = 1.75, height = 2.5) {
    const group = place(floors[floor].group, x, z, 0);
    box(group, color, 0, height / 2, -0.3, width, height, 0.12);
    for (const side of [-1, 1]) box(group, color, side * (width / 2 - 0.07), height / 2, 0, 0.14, height, 0.7);
    const colors = [0xf28d9b, 0xffd458, 0x63b8dc, 0x9bc56c, 0xb7a3e4];
    for (let shelf = 0; shelf < 3; shelf++) {
      const y = 0.14 + shelf * (height - 0.3) / 2;
      box(group, color, 0, y, 0, width, 0.12, 0.7);
      if (shelf === 2) continue;
      for (let book = 0; book < 5; book++) {
        box(group, colors[(book + shelf) % colors.length], -width * 0.33 + book * width * 0.16, y + 0.32, 0.05, width * 0.12, 0.48 + book % 2 * 0.16, 0.44);
      }
    }
    footprint(floor, x, z, width, 0.75);
    return group;
  }
  function teddy(parent, x, z, color = 0xd79b70) {
    const group = place(parent, x, z, 0);
    ball(group, color, 0, 0.35, 0, 0.24, 0.3, 0.2);
    ball(group, color, 0, 0.7, 0, 0.23);
    for (const side of [-1, 1]) {
      ball(group, color, side * 0.19, 0.87, 0, 0.1);
      ball(group, color, side * 0.2, 0.18, 0.1, 0.12, 0.12, 0.19);
      ball(group, C.dark, side * 0.075, 0.74, 0.22, 0.025);
    }
    ball(group, C.cream, 0, 0.62, 0.21, 0.12, 0.08, 0.06);
    return group;
  }
  function dinosaur(parent, x, z, color, scale = 1) {
    const group = place(parent, x, z, 0);
    group.scale.setScalar(scale);
    ball(group, color, 0, 0.42, 0, 0.52, 0.33, 0.27);
    ball(group, color, 0.34, 0.8, 0, 0.17, 0.43, 0.16);
    ball(group, color, 0.49, 1.1, 0.01, 0.3, 0.17, 0.17);
    rod(group, color, [-0.4, 0.4, 0], [-0.95, 0.25, 0], 0.12);
    for (const side of [-1, 1]) {
      rod(group, color, [side * 0.3, 0.4, 0], [side * 0.3, 0.1, 0.13], 0.11);
      ball(group, C.white, 0.49, 1.15, side * 0.15, 0.055);
      ball(group, C.dark, 0.51, 1.15, side * 0.193, 0.025);
    }
    for (let spine = 0; spine < 4; spine++) {
      const fin = flat(group, triangleGeometry, 0xefa869, -0.42 + spine * 0.22, 0.73, 0, 0.22);
      fin.rotation.z = Math.PI;
    }
    return group;
  }

  // Wide central openings connect each room to the clear eastern circulation lane.
  for (let floor = 0; floor < floors.length; floor++) {
    const group = place(interior, 120, 0, floor * 4.8);
    group.name = floors[floor].name;
    group.visible = floor === 0;
    floors[floor].group = group;
    const base = floor === 1 ? 0xffdc65 : floor === 2 ? 0xb0e5ef : 0xf4dc9e;
    if (floor === 0) box(group, base, 0, -0.14, 0, 20, 0.28, 20);
    else {
      // The narrow stairwell is genuinely open; its arrival lane remains solid.
      box(group, base, -1.85, -0.14, 0, 16.3, 0.28, 20);
      box(group, base, 8.7, -0.14, 0, 2.6, 0.28, 20);
      box(group, base, 6.85, -0.14, -2.9, 1.1, 0.28, 14.2);
      box(group, base, 6.85, -0.14, 9.6, 1.1, 0.28, 0.8);
    }
    solid(floor, floor === 1 ? C.lavender : C.cream, 0, 2, -9.9, 20, 4, 0.2);
    solid(floor, floor === 2 ? C.mint : C.cream, -9.9, 0.62, 0, 0.2, 1.24, 20);
    solid(floor, floor === 1 ? C.lavender : C.cream, 9.9, 0.45, 0, 0.2, 0.9, 20);
    solid(floor, C.cream, -5.65, 0.24, 9.9, 8.7, 0.48, 0.2);
    solid(floor, C.cream, 5.65, 0.24, 9.9, 8.7, 0.48, 0.2);
    const light = new THREE.PointLight(0xfff4df, 48, 30, 1.55);
    light.position.set(0, 6.3, 0);
    group.add(light);
  }

  const ground = floors[0].group;
  // The garage is a workshop rather than a second instance of the family car.
  box(ground, 0xeadf9e, -5.8, 0.012, 5.1, 7.95, 0.02, 9.45);
  solid(0, 0xfff2bd, -7.5, 0.5, 0.3, 4.6, 1, 0.2);
  solid(0, 0xfff2bd, -1.7, 0.48, 2, 0.2, 0.96, 3.4);
  solid(0, 0xfff2bd, -1.7, 0.48, 8.4, 0.2, 0.96, 2.8);
  mural(ground, -9.77, 1.45, 5.3, 8.9, 2.8, (ctx, width, height) => {
    ctx.fillStyle = '#fff2bf'; ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#e4dca8'; ctx.lineWidth = 3;
    for (let row = 0; row < 9; row++) {
      const y = row * 64;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      for (let x = row % 2 ? 65 : 0; x < width; x += 130) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 64); ctx.stroke();
      }
    }
  }, Math.PI / 2);
  const garageDoor = place(ground, -9.65, 6.55, 0);
  garageDoor.rotation.y = Math.PI / 2;
  box(garageDoor, C.yellow, 0, 1.48, 0, 2.1, 2.96, 0.16);
  box(garageDoor, 0xf6e65f, 0, 1.48, 0.1, 1.77, 2.64, 0.045);
  ball(garageDoor, C.wood, 0.65, 1.33, 0.16, 0.08);
  footprint(0, -9.65, 6.55, 0.2, 2.1);
  const bench = place(ground, -8.35, 2.5, 0);
  box(bench, C.wood, 0, 1.15, 0, 1.65, 0.18, 3.2);
  for (const z of [-1.3, 1.3]) box(bench, 0xb99860, 0, 0.54, z, 1.35, 1.08, 0.14);
  box(bench, 0xd0b88b, -0.66, 2.08, 0, 0.1, 1.45, 3);
  for (let tool = 0; tool < 5; tool++) {
    const z = -1.12 + tool * 0.55;
    rod(bench, tool % 2 ? 0x69a6b5 : 0xd48464, [-0.55, 1.69, z], [-0.55, 2.35, z], 0.05);
    box(bench, 0x7e9599, -0.5, 2.4, z, 0.15, 0.14, tool % 2 ? 0.12 : 0.34);
  }
  cylinder(bench, 0x77a78d, 0.15, 1.53, 0.83, 0.22, 0.54);
  cylinder(bench, 0xe9a481, 0.15, 1.47, -0.6, 0.2, 0.42);
  footprint(0, -8.35, 2.5, 1.75, 3.2);
  const garageShelf = bookcase(0, -6.2, 8.7, 0xb8a579, 3.4, 2.3);
  garageShelf.rotation.y = Math.PI;
  ball(garageShelf, 0x69b776, -0.8, 2.55, 0, 0.5, 0.24, 0.32);
  ball(garageShelf, C.pink, 0.45, 2.55, 0, 0.4, 0.25, 0.3);
  rod(ground, 0x8da076, [-9.1, 3.15, 0.5], [-2.4, 3.15, 0.5], 0.025);
  for (let flag = 0; flag < 10; flag++) {
    flat(ground, triangleGeometry, flag % 2 ? 0x45a678 : 0x609fd8, -8.9 + flag * 0.7, 2.87, 0.5, 0.48, 0.64);
  }
  const bicycle = place(ground, -5.1, 2.15, 0);
  for (const x of [-0.93, 0.93]) {
    flat(bicycle, ringGeometry, 0x526579, x, 0.57, 0, 0.53);
    rod(bicycle, 0xd7d8c2, [x - 0.48, 0.57, 0], [x + 0.48, 0.57, 0], 0.025);
    rod(bicycle, 0xd7d8c2, [x, 0.1, 0], [x, 1.04, 0], 0.025);
  }
  for (const [a, b] of [
    [[-0.93, 0.57, 0], [-0.15, 0.56, 0]], [[-0.93, 0.57, 0], [-0.5, 1.2, 0]],
    [[-0.5, 1.2, 0], [-0.15, 0.56, 0]], [[-0.5, 1.2, 0], [0.55, 1.2, 0]],
    [[-0.15, 0.56, 0], [0.55, 1.2, 0]], [[0.55, 1.2, 0], [0.93, 0.57, 0]],
  ]) rod(bicycle, 0xca5b79, a, b, 0.045);
  box(bicycle, C.dark, -0.5, 1.31, 0, 0.44, 0.12, 0.23);
  rod(bicycle, C.dark, [0.55, 1.2, 0], [0.5, 1.7, 0], 0.04);
  rod(bicycle, C.dark, [0.5, 1.7, -0.3], [0.5, 1.7, 0.3], 0.04);
  footprint(0, -5.1, 2.15, 3, 0.85);
  const scooter = place(ground, -3.4, 8.15, 0);
  box(scooter, 0x9672cd, 0, 0.22, 0, 0.35, 0.13, 1.4);
  rod(scooter, 0x9672cd, [0, 0.25, -0.6], [0, 1.58, -0.6], 0.06);
  rod(scooter, C.dark, [-0.34, 1.58, -0.6], [0.34, 1.58, -0.6], 0.05);
  for (const z of [-0.6, 0.6]) {
    const wheel = flat(scooter, ringGeometry, C.dark, 0, 0.2, z, 0.18);
    wheel.rotation.y = Math.PI / 2;
  }
  footprint(0, -3.4, 8.15, 0.7, 1.6);

  // Familiar kitchen fittings, with the dining spot away from both room entrances.
  box(ground, 0xdcebb5, -5.75, 0.014, -4.8, 8.1, 0.024, 9.7);
  box(ground, 0xe9f5cd, -5.7, 2, -9.78, 8, 3.96, 0.045);
  solid(0, C.cream, -1.65, 0.58, -7.4, 0.18, 1.16, 4.75);
  const kitchen = place(ground, -5.9, -8.95, 0);
  box(kitchen, 0x8fcaba, 0, 0.73, 0, 6.2, 1.46, 1.2);
  box(kitchen, C.white, 0, 1.49, 0, 6.4, 0.14, 1.35);
  for (let door = 0; door < 5; door++) {
    box(kitchen, 0xbde4ce, -2.4 + door * 1.2, 0.77, 0.63, 1.08, 1.15, 0.07);
    box(kitchen, C.white, -2.12 + door * 1.2, 1.05, 0.68, 0.23, 0.06, 0.07);
  }
  box(kitchen, 0x657c82, -1.95, 1.58, 0, 1.3, 0.035, 0.94);
  for (const x of [-2.26, -1.64]) for (const z of [-0.25, 0.25]) cylinder(kitchen, C.dark, x, 1.61, z, 0.19, 0.026);
  box(kitchen, C.dark, -1.95, 0.73, 0.69, 0.96, 0.65, 0.035);
  box(kitchen, 0xa7cacf, -1.95, 0.73, 0.714, 0.77, 0.43, 0.014);
  box(kitchen, 0xb7dcdf, 0.65, 1.59, 0, 1.42, 0.055, 0.91);
  box(kitchen, 0x6eabb7, 0.65, 1.63, 0, 1.14, 0.024, 0.65);
  rod(kitchen, 0xc9e1df, [0.65, 1.6, -0.38], [0.65, 2.1, -0.38], 0.05);
  rod(kitchen, 0xc9e1df, [0.65, 2.1, -0.38], [0.65, 2.1, -0.03], 0.05);
  footprint(0, -5.9, -8.95, 6.4, 1.35);
  window(ground, -4.8, 2.85, -9.67);
  const fridge = place(ground, -8.95, -5.8, 0);
  box(fridge, C.white, 0, 1.43, 0, 1.5, 2.86, 1.45);
  box(fridge, 0xe6eedd, 0, 1.78, 0.74, 1.38, 2.05, 0.07);
  box(fridge, 0xe6eedd, 0, 0.36, 0.74, 1.38, 0.63, 0.07);
  box(fridge, 0x8eb4ae, 0.48, 1.75, 0.81, 0.07, 0.55, 0.06);
  box(fridge, C.pink, -0.26, 2.1, 0.79, 0.43, 0.49, 0.018);
  footprint(0, -8.95, -5.8, 1.55, 1.6);
  const dining = place(ground, -5.9, -4.25, 0);
  cylinder(dining, 0xf2c678, 0, 1.2, 0, 1.13, 0.15);
  cylinder(dining, C.wood, 0, 0.56, 0, 0.17, 1.12);
  cylinder(dining, C.white, 0, 1.3, 0, 0.34, 0.04);
  ball(dining, 0xef856d, -0.1, 1.45, 0, 0.15);
  ball(dining, C.yellow, 0.13, 1.46, 0, 0.16);
  footprint(0, -5.9, -4.25, 2.3, 2.3);
  for (const z of [-6.05, -2.45]) {
    const chair = place(ground, -5.9, z, 0);
    box(chair, C.mint, 0, 0.63, 0, 0.82, 0.15, 0.8);
    box(chair, C.mint, 0, 1, z < -4 ? -0.33 : 0.33, 0.82, 0.83, 0.12);
    for (const x of [-0.29, 0.29]) for (const dz of [-0.29, 0.29]) box(chair, C.wood, x, 0.29, dz, 0.09, 0.58, 0.09);
    footprint(0, -5.9, z, 0.85, 0.85);
  }

  const sofa = place(ground, 2.7, -6.55, 0);
  box(sofa, 0x946bd0, 0, 0.48, 0, 4.7, 0.8, 1.8);
  box(sofa, 0xad84de, 0, 1.15, -0.68, 4.7, 1.2, 0.42);
  for (const side of [-1, 1]) box(sofa, 0xad84de, side * 2.18, 0.95, 0, 0.34, 0.92, 1.8);
  for (const [x, color] of [[-1.4, 0x58b8cf], [0, 0xef95bc], [1.4, 0x7cc9b0]]) {
    box(sofa, color, x, 0.94, 0.05, 1.26, 0.18, 1.18);
    box(sofa, color, x, 1.33, -0.38, 0.86, 0.74, 0.25).rotation.z = x * 0.07;
  }
  footprint(0, 2.7, -6.55, 4.7, 1.8);
  box(ground, 0xf1d3ea, 2.6, 2, -9.77, 7.05, 3.95, 0.04);
  curtain(ground, 2.4, -9.65, 0xf5c963, 2.3);
  rug(ground, 2.65, -2.6, 2.7, 2, [0x70c7c9, 0xffd97b, 0xef98b9]);
  const tv = place(ground, 4.85, 1.35, 0);
  tv.rotation.y = Math.PI;
  box(tv, C.wood, 0, 0.54, 0, 1.6, 1.08, 0.9);
  box(tv, C.dark, 0, 1.67, 0, 1.85, 1.23, 0.25);
  box(tv, 0x91dceb, 0, 1.67, 0.145, 1.58, 0.96, 0.024);
  ball(tv, C.yellow, 0.42, 1.93, 0.168, 0.18, 0.18, 0.013);
  ball(tv, 0x87c971, -0.28, 1.38, 0.17, 0.63, 0.25, 0.014);
  rod(tv, C.dark, [0, 2.32, 0], [-0.34, 2.7, 0], 0.023);
  rod(tv, C.dark, [0, 2.32, 0], [0.34, 2.7, 0], 0.023);
  footprint(0, 4.85, 1.35, 1.9, 1);
  const lamp = place(ground, 5.45, -8.5, 0);
  cylinder(lamp, C.wood, 0, 1.18, 0, 0.06, 2.36);
  cylinder(lamp, 0xffd864, 0, 2.4, 0, 0.47, 0.48);
  footprint(0, 5.45, -8.5, 0.8, 0.8);

  const bootsMat = place(ground, 2, 6, 0);
  box(bootsMat, 0x75babb, 0, 0.025, 0, 2.2, 0.05, 1.6);
  box(bootsMat, 0xece4bb, 0, 0.055, 0, 1.93, 0.012, 1.32);
  const boots = place(ground, 2, 6, 0.06);
  for (const side of [-1, 1]) {
    cylinder(boots, 0xf5cb56, side * 0.3, 0.47, -0.07, 0.235, 0.84);
    ball(boots, 0xf5cb56, side * 0.3, 0.17, 0.19, 0.24, 0.17, 0.42);
    cylinder(boots, 0xcb9b38, side * 0.3, 0.9, -0.07, 0.193, 0.026);
    box(boots, 0xdeaf46, side * 0.3, 0.045, 0.17, 0.46, 0.075, 0.7);
  }
  interact('boots', 'pickup', '穿上黄色雨靴', 122, 6, boots, 'inside', 2.4, 0);
  const exit = place(ground, 0, 9, 0);
  box(exit, 0xc9b38b, 0, 0.026, 0, 2.3, 0.04, 1.1);
  box(exit, C.cream, 0, 0.052, 0, 1.96, 0.012, 0.78);
  const exitArrow = flat(exit, triangleGeometry, 0x71a783, 0, 0.068, 0.06, 0.8);
  exitArrow.rotation.x = -Math.PI / 2;
  interact('home-exit', 'door', '回到花园', 120, 9, exit, 'inside', 2, 0);

  const middle = floors[1].group;
  box(middle, 0xffef8f, -5.85, 0.012, -5.65, 7.9, 0.02, 8.3);
  box(middle, 0xfff1ac, -5.85, 2, -9.77, 7.9, 3.96, 0.045);
  solid(1, C.mint, -1.75, 0.56, -5.6, 0.2, 1.12, 8.3);
  solid(1, C.mint, -7.7, 0.5, -1.4, 4.2, 1, 0.2);
  solid(1, C.mint, -2.15, 0.5, -1.4, 0.8, 1, 0.2);
  doorway(middle, -4.1, -1.4, 3);
  curtain(middle, -6.1, -9.65, 0x8adfcd);
  const nurseryDresser = dresser(1, -8.3, -8.7, C.lavender, 2.1);
  box(nurseryDresser, 0xa7e5d1, 0, 1.82, 0, 1.85, 0.14, 0.77);
  const cot = place(middle, -3.4, -7.95, 0);
  box(cot, C.purple, 0, 0.58, 0, 2.8, 0.18, 1.85);
  box(cot, C.white, 0, 0.76, 0, 2.55, 0.2, 1.6);
  box(cot, 0xa7e7d5, 0.5, 0.88, 0, 1.5, 0.08, 1.48);
  for (const x of [-1.36, 1.36]) {
    box(cot, C.lavender, x, 1.05, 0, 0.15, 1.65, 1.9);
    ball(cot, C.lavender, x, 1.9, 0, 0.075, 0.2, 0.92);
    flat(cot, starGeometry, 0x9274cb, x, 1.57, 0.963, 0.15);
  }
  for (const z of [-0.88, 0.88]) {
    rod(cot, C.lavender, [-1.35, 1.55, z], [1.35, 1.55, z], 0.065);
    for (let bar = 0; bar < 8; bar++) rod(cot, C.lavender, [-1.18 + bar * 0.337, 0.55, z], [-1.18 + bar * 0.337, 1.55, z], 0.038);
  }
  footprint(1, -3.4, -7.95, 2.95, 2);
  rug(middle, -5.7, -4.5, 2.75, 1.65, [0x64bedb, 0x9ce4e5]);
  bookcase(1, -9, -3.5, 0x79cfc2, 1.25, 1.7);
  teddy(middle, -7.3, -4.5, 0xf1d16a);
  mural(middle, -3.15, 2.9, -9.64, 2.55, 1.6, (ctx) => {
    cloud(ctx, 290, 140, 80);
    ctx.fillStyle = '#ffe96e';
    for (const x of [230, 510, 790]) {
      ctx.beginPath(); ctx.ellipse(x, 390, 84, 49, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 56, 323, 44, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#efb568'; ctx.fillRect(x + 90, 324, 44, 16);
      ctx.fillStyle = '#526c6b'; ctx.beginPath(); ctx.arc(x + 66, 314, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe96e';
    }
  });

  // Parents' bedroom opens directly onto the central landing.
  box(middle, 0xf4d8de, -5.8, 0.013, 6.6, 8, 0.02, 6.4);
  solid(1, C.lavender, -8, 0.48, 3.3, 3.6, 0.96, 0.2);
  solid(1, C.lavender, -2.55, 0.48, 3.3, 1.6, 0.96, 0.2);
  solid(1, C.lavender, -1.75, 0.48, 6.6, 0.2, 0.96, 6.4);
  doorway(middle, -4.65, 3.3, 3.1);
  const parentsBed = place(middle, -6.5, 7.45, 0);
  box(parentsBed, 0xa28aca, 0, 0.47, 0, 3.8, 0.75, 3.6);
  box(parentsBed, C.white, 0, 0.92, 0, 3.65, 0.18, 3.4);
  box(parentsBed, 0xed94bc, 0, 1.05, -0.5, 3.65, 0.14, 2.3);
  box(parentsBed, 0xb8a0dd, 0, 1.22, 1.7, 3.95, 1.7, 0.2);
  for (const x of [-0.94, 0.94]) box(parentsBed, C.cream, x, 1.13, 1.04, 1.35, 0.25, 0.74);
  footprint(1, -6.5, 7.45, 3.98, 3.7);
  const bedside = dresser(1, -3.3, 8.35, 0xc3ade5, 1.3);
  cylinder(bedside, C.yellow, 0, 2.12, 0, 0.3, 0.38);
  cylinder(bedside, C.white, 0, 1.89, 0, 0.13, 0.35);
  solid(1, 0xc3ade5, -9.05, 1.32, 5.45, 1.2, 2.64, 1.8);
  for (const z of [5.12, 5.76]) ball(middle, C.yellow, -8.4, 1.36, z, 0.07);

  // Bathroom: all fixtures sit against the edges, not across its wide entrance.
  box(middle, 0xd0f0ed, 2.8, 0.012, -6.55, 5.9, 0.02, 6.35);
  box(middle, 0xbbe8eb, 2.8, 2, -9.77, 5.95, 3.96, 0.045);
  solid(1, 0xbce9e9, -0.25, 0.53, -6.55, 0.2, 1.06, 6.35);
  solid(1, 0xbce9e9, 0, 0.53, -3.3, 0.5, 1.06, 0.2);
  solid(1, 0xbce9e9, 4.7, 0.53, -3.3, 2.1, 1.06, 0.2);
  doorway(middle, 1.95, -3.3, 3.3);
  const bath = place(middle, 3.65, -8.65, 0);
  box(bath, C.white, 0, 0.55, 0, 3.6, 1.1, 1.8);
  box(bath, 0xa5dce5, 0, 1.11, 0, 3.15, 0.025, 1.35);
  box(bath, 0xd7f4f0, 0, 1.14, 0, 2.83, 0.018, 1.05);
  rod(bath, 0xa5bfc2, [1.25, 1.1, -0.62], [1.25, 1.45, -0.62], 0.055);
  rod(bath, 0xa5bfc2, [1.25, 1.45, -0.62], [1.25, 1.45, -0.2], 0.055);
  footprint(1, 3.65, -8.65, 3.7, 1.9);
  const basin = place(middle, 0.7, -8.65, 0);
  cylinder(basin, C.white, 0, 0.54, 0, 0.23, 1.08);
  ball(basin, C.white, 0, 1.18, 0, 0.64, 0.19, 0.48);
  ball(basin, 0xa4d6e3, 0, 1.31, 0.05, 0.45, 0.035, 0.3);
  rod(basin, 0x96b4ba, [0, 1.27, -0.33], [0, 1.57, -0.33], 0.045);
  footprint(1, 0.7, -8.65, 1.3, 1);
  box(middle, C.white, 0.7, 2.4, -9.59, 1.36, 1.5, 0.12);
  box(middle, 0xb4e0ec, 0.7, 2.4, -9.51, 1.16, 1.3, 0.03);
  const toilet = place(middle, 4.9, -5.55, 0);
  box(toilet, C.white, 0, 0.97, -0.4, 0.85, 1.12, 0.32);
  ball(toilet, C.white, 0, 0.58, 0.14, 0.53, 0.35, 0.67);
  ball(toilet, 0xc7e8e6, 0, 0.86, 0.17, 0.4, 0.07, 0.51);
  footprint(1, 4.9, -5.55, 1.1, 1.65);
  rug(middle, 2.15, -5.75, 1.1, 0.75, [0x83cbc6, 0xb9ead7]);

  const roundWindow = place(middle, 7.9, -9.67, 2.8);
  flat(roundWindow, discGeometry, 0x92dce8, 0, 0, 0, 0.87);
  flat(roundWindow, ringGeometry, C.white, 0, 0, 0.035, 0.9);
  box(roundWindow, C.white, 0, 0, 0.08, 0.09, 1.75, 0.07);
  box(roundWindow, C.white, 0, 0, 0.08, 1.75, 0.09, 0.07);
  dresser(1, 3.95, 8.7, 0xa5d9ce, 2.3);
  rug(middle, 2.2, 1.2, 1.8, 1.25, [0xf0c65e, 0xffe88c]);

  const attic = floors[2].group;
  box(attic, 0xb9eaf0, -5.75, 0.013, -2.45, 8.1, 0.022, 14.6);
  box(attic, 0x81c9e7, 2.4, 0.014, -2.45, 6.9, 0.022, 14.6);
  box(attic, C.mint, -5.75, 2, -9.77, 8.1, 3.96, 0.045);
  box(attic, 0x86d2ec, 2.4, 2, -9.77, 6.9, 3.96, 0.045);
  solid(2, C.mint, -1.45, 0.63, -3.65, 0.2, 1.26, 12.3);
  solid(2, C.mint, -8.4, 0.43, 4.85, 2.8, 0.86, 0.18);
  solid(2, C.mint, -2.25, 0.43, 4.85, 1.6, 0.86, 0.18);
  solid(2, 0x90d7ee, -0.65, 0.43, 4.85, 1.4, 0.86, 0.18);
  solid(2, 0x90d7ee, 4.65, 0.43, 4.85, 2.7, 0.86, 0.18);
  solid(2, 0x90d7ee, 6.05, 0.43, -7.25, 0.16, 0.86, 5.1);
  solid(2, 0x90d7ee, 6.05, 0.43, 3.3, 0.16, 0.86, 3.1);
  doorway(attic, -5, 4.85, 4);
  doorway(attic, 1.65, 4.85, 3.2);

  mural(attic, -5.8, 2.05, -9.66, 7.95, 3.83, (ctx, width, height) => {
    ctx.fillStyle = '#f7b9d7'; ctx.fillRect(0, 0, width, height);
    for (const [x, y, radius] of [[145, 90, 38], [460, 68, 31], [775, 113, 42], [940, 63, 24]]) cloud(ctx, x, y, radius);
    ctx.lineWidth = 21;
    for (const [index, color] of ['#e989b6', '#ffbc68', '#fff487', '#8bddac', '#9bceec'].entries()) {
      ctx.strokeStyle = color; ctx.beginPath(); ctx.arc(130, 360, 185 - index * 21, Math.PI, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = '#8ce1c2'; ctx.fillRect(0, 420, width, 92);
    for (const [x, y, size] of [[405, 395, 95], [900, 395, 115], [974, 430, 74]]) {
      ctx.fillStyle = '#60b99b';
      for (let tier = 0; tier < 3; tier++) {
        ctx.beginPath(); ctx.moveTo(x, y - size + tier * 29); ctx.lineTo(x - size * 0.48, y - size * 0.35 + tier * 29); ctx.lineTo(x + size * 0.48, y - size * 0.35 + tier * 29); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#b89b70'; ctx.fillRect(x - 7, y + 15, 14, 44);
    }
    ctx.fillStyle = '#e8d6ef'; ctx.fillRect(586, 286, 214, 126);
    for (const x of [576, 680, 782]) {
      ctx.fillStyle = '#efe2f4'; ctx.fillRect(x, 238, 40, 167);
      ctx.fillStyle = '#aa80d3'; ctx.beginPath(); ctx.moveTo(x - 8, 238); ctx.lineTo(x + 20, 183); ctx.lineTo(x + 49, 238); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffc95f'; ctx.fillRect(x + 19, 163, 4, 22);
    }
    ctx.fillStyle = '#ac8bc7'; ctx.fillRect(670, 350, 38, 62);
  });
  const loft = place(attic, -6.4, -7.65, 0);
  for (const x of [-2.35, 2.35]) for (const z of [-1.22, 1.22]) {
    box(loft, C.purple, x, 1.65, z, 0.16, 3.3, 0.16);
    footprint(2, -6.4 + x, -7.65 + z, 0.22, 0.22);
  }
  box(loft, C.purple, 0, 2.37, 0, 4.9, 0.2, 2.65);
  box(loft, C.cream, 0, 2.55, 0, 4.55, 0.17, 2.43);
  box(loft, 0x93e3b4, 0.4, 2.67, 0, 3.45, 0.08, 2.36);
  box(loft, 0xecc6f1, -1.73, 2.73, 0, 0.8, 0.23, 1.7);
  box(loft, 0xb989e3, 0, 3.03, 1.24, 4.8, 0.53, 0.12);
  box(loft, 0xb989e3, 0, 3.03, -1.24, 4.8, 0.53, 0.12);
  for (const x of [-1.6, -0.75, 0.1, 0.95, 1.8]) {
    const patch = flat(loft, starGeometry, x % 1 < 0 ? 0xffe469 : 0xf5b1d3, x, 2.73, 0.1, 0.22);
    patch.rotation.x = -Math.PI / 2;
  }
  box(loft, 0x6ccbd1, 0, 0.2, -0.48, 3.7, 0.35, 1.2);
  box(loft, 0x81d7d8, 0, 0.66, -1.02, 3.7, 0.73, 0.16);
  footprint(2, -6.4, -8.15, 3.7, 1.3);
  for (const x of [-1, 1]) ball(loft, x < 0 ? 0xe48cbd : 0xffd979, x, 0.55, -0.45, 0.37, 0.25, 0.26);
  const ladder = place(attic, -3.38, -7.4, 0);
  for (const x of [-0.36, 0.36]) rod(ladder, C.purple, [x, 0.08, 1], [x, 2.9, -0.2], 0.075);
  for (let rung = 0; rung < 7; rung++) {
    const y = 0.3 + rung * 0.39;
    const z = 1 - (y - 0.08) / 2.82 * 1.2;
    rod(ladder, C.purple, [-0.36, y, z], [0.36, y, z], 0.055);
  }
  footprint(2, -3.38, -7, 0.86, 1.5);
  const peppaWindow = place(attic, -9.68, -4.7, 0);
  peppaWindow.rotation.y = Math.PI / 2;
  curtain(peppaWindow, 0, 0, 0xe999c9, 2.1);
  const georgeWindow = place(attic, 5.95, -5.2, 0);
  georgeWindow.rotation.y = -Math.PI / 2;
  curtain(georgeWindow, 0, 0, 0xf3ab69, 2.05);
  rod(attic, C.wood, [-5.1, 4.7, -4.7], [-5.1, 3.95, -4.7], 0.022);
  flat(attic, starGeometry, 0xffd75a, -5.1, 3.45, -4.7, 0.62);
  flat(attic, starGeometry, 0xffed9b, -5.1, 3.45, -4.65, 0.38);
  for (const [x, z, y] of [[-6, -4.7, 3.62], [-4.35, -4.7, 3.7]]) {
    rod(attic, C.cream, [x, 4.25, z], [x, y + 0.2, z], 0.012);
    flat(attic, starGeometry, 0xffe17c, x, y, z, 0.22);
  }
  const storage = place(attic, -8.95, -1.1, 0);
  storage.rotation.y = Math.PI / 2;
  box(storage, C.purple, 0, 0.93, -0.1, 3, 1.86, 0.95);
  const cubeColors = [0xf2cb56, 0xf78faf, 0x6bc9d9, 0x8ed37c, 0xa991df, 0xffd35c];
  for (let cube = 0; cube < 6; cube++) {
    const x = -0.98 + cube % 3 * 0.98;
    const y = 0.49 + Math.floor(cube / 3) * 0.89;
    box(storage, cubeColors[cube], x, y, 0.41, 0.87, 0.77, 0.12);
    box(storage, C.cream, x, y + 0.13, 0.49, 0.2, 0.055, 0.025);
  }
  footprint(2, -8.95, -1.1, 1.05, 3.1);
  rug(attic, -5.7, -2.5, 2.05, 1.65, [0xf69fb6, 0xffdf6e, 0x90d9bb]);
  teddy(attic, -6.25, -2.55);
  for (const [x, z, color] of [[-4.7, -2.5, 0xa381d0], [-4.2, -1.9, 0x63bbd4], [-4.8, -1.85, 0xf7c958]]) {
    box(attic, color, x, 0.19, z, 0.35, 0.36, 0.35).rotation.y = 0.2;
  }
  ball(attic, 0xec8fbd, -8.2, 0.45, 2.65, 0.86, 0.45, 0.73);
  footprint(2, -8.2, 2.65, 1.5, 1.3);

  mural(attic, 2.25, 2.05, -9.66, 7.05, 3.84, (ctx, width, height) => {
    ctx.fillStyle = '#8fd5ed'; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#ffd16f'; ctx.beginPath(); ctx.moveTo(120, 0); ctx.lineTo(930, 0); ctx.lineTo(width, 330); ctx.lineTo(width, height); ctx.lineTo(0, height); ctx.lineTo(0, 145); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f9b85f';
    for (const [x, y] of [[260, 290], [770, 250]]) {
      ctx.beginPath(); ctx.ellipse(x, y, 100, 47, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(x + 50, y - 125, 35, 145);
      ctx.beginPath(); ctx.ellipse(x + 88, y - 120, 53, 24, 0, 0, Math.PI * 2); ctx.fill();
      for (const dx of [-50, 45]) ctx.fillRect(x + dx, y + 13, 25, 85);
      ctx.beginPath(); ctx.moveTo(x - 70, y - 10); ctx.lineTo(x - 165, y - 55); ctx.lineTo(x - 95, y + 25); ctx.closePath(); ctx.fill();
    }
    for (const [x, y, color] of [[210, 110, '#7789d3'], [840, 95, '#db857b'], [650, 170, '#90ae63']]) {
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 78, y - 35); ctx.lineTo(x - 26, y + 17); ctx.lineTo(x - 6, y + 8); ctx.lineTo(x + 33, y + 55); ctx.lineTo(x + 41, y + 20); ctx.lineTo(x + 75, y + 30); ctx.lineTo(x + 34, y - 4); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#a87960'; ctx.beginPath(); ctx.moveTo(865, height); ctx.lineTo(940, 324); ctx.lineTo(982, 335); ctx.lineTo(width, height); ctx.closePath(); ctx.fill();
  });
  const dinoBed = place(attic, 3.1, -7.35, 0);
  box(dinoBed, 0x68be56, 0, 0.41, 0, 2.45, 0.7, 3.7);
  box(dinoBed, C.cream, 0, 0.8, 0, 2.17, 0.2, 3.37);
  box(dinoBed, 0x638de1, 0, 0.95, 0.52, 2.17, 0.13, 2.28);
  box(dinoBed, 0xc4e5d8, 0, 1.02, -1.1, 1.56, 0.24, 0.72);
  ball(dinoBed, 0x68c65e, 0, 1.51, -1.72, 1.15, 1.28, 0.16);
  ball(dinoBed, 0x7ed56a, 0.34, 1.94, -1.55, 0.84, 0.39, 0.18);
  for (const x of [-0.4, 0.08]) {
    ball(dinoBed, C.white, x, 2.35, -1.51, 0.13, 0.16, 0.055);
    ball(dinoBed, C.dark, x + 0.025, 2.36, -1.453, 0.048, 0.065, 0.02);
  }
  rod(dinoBed, 0x3a984c, [-0.3, 1.8, -1.33], [0.84, 1.8, -1.33], 0.026);
  ball(dinoBed, 0x72cc61, 0.86, 0.95, 1.59, 0.55, 0.66, 0.22);
  for (let fin = 0; fin < 4; fin++) {
    const plate = flat(dinoBed, triangleGeometry, 0x43a755, -0.86 + fin * 0.4, 2.65 - Math.abs(fin - 1) * 0.11, -1.7, 0.35);
    plate.rotation.z = Math.PI;
  }
  footprint(2, 3.1, -7.35, 2.6, 3.9);
  const georgeBooks = bookcase(2, 0.1, -8.55, 0xf4dfbf, 1.6, 2.5);
  const globe = place(georgeBooks, 0, 0, 2.45);
  cylinder(globe, C.wood, 0, 0.14, 0, 0.3, 0.12);
  rod(globe, C.dark, [0, 0.17, 0], [0, 0.8, 0], 0.035);
  ball(globe, 0x86cde5, 0, 0.68, 0, 0.43);
  ball(globe, 0x82bf6b, -0.1, 0.79, 0.36, 0.22, 0.19, 0.035);
  ball(globe, 0x82bf6b, 0.2, 0.52, 0.3, 0.15, 0.14, 0.03);
  const globeRing = flat(globe, ringGeometry, C.wood, 0, 0.68, 0, 0.5);
  globeRing.rotation.z = -0.32;
  const desk = place(attic, 4.6, -1.8, 0);
  box(desk, 0xf2cf8b, 0, 1.1, 0, 2.05, 0.15, 1.2);
  for (const x of [-0.86, 0.86]) for (const z of [-0.45, 0.45]) box(desk, C.wood, x, 0.52, z, 0.12, 1.04, 0.12);
  box(desk, C.cream, -0.2, 1.2, 0.15, 0.73, 0.035, 0.48);
  cylinder(desk, 0xe9a259, 0.6, 1.41, -0.25, 0.14, 0.4);
  for (let pencil = 0; pencil < 3; pencil++) rod(desk, [0xe6899d, 0x76b67d, 0x7d9dd1][pencil], [0.53 + pencil * 0.07, 1.37, -0.25], [0.51 + pencil * 0.08, 1.85, -0.25], 0.022);
  footprint(2, 4.6, -1.8, 2.1, 1.3);
  const deskChair = place(attic, 4.55, -0.45, 0);
  box(deskChair, 0x7cbaed, 0, 0.63, 0, 0.76, 0.15, 0.74);
  box(deskChair, 0x7cbaed, 0, 1.02, 0.3, 0.76, 0.78, 0.12);
  for (const x of [-0.27, 0.27]) for (const z of [-0.26, 0.26]) box(deskChair, C.wood, x, 0.29, z, 0.09, 0.58, 0.09);
  footprint(2, 4.55, -0.45, 0.8, 0.8);
  rug(attic, 1.8, -2.8, 1.5, 1.1, [0x72beba, 0x9ed483]);
  dinosaur(attic, 0.2, -2.9, 0xd67983, 0.85);
  dinosaur(attic, 2.8, 1.4, 0x729cdb, 0.92);
  dinosaur(attic, 0.4, 1.1, 0x72bc69, 0.52);
  const toyTruck = place(attic, 4.75, 2.7, 0);
  box(toyTruck, 0xebaa50, 0, 0.3, 0, 0.87, 0.3, 0.44);
  box(toyTruck, 0xe98e5d, 0.22, 0.57, 0, 0.34, 0.3, 0.42);
  for (const x of [-0.28, 0.28]) for (const z of [-0.23, 0.23]) ball(toyTruck, C.dark, x, 0.17, z, 0.12, 0.12, 0.055);

  const camera = place(attic, -5, 2, 0);
  box(camera, 0xe6a46e, 0, 0.45, 0, 1.06, 0.75, 0.4);
  box(camera, 0x506872, 0, 0.49, 0.23, 0.98, 0.46, 0.06);
  const cameraLens = cylinder(camera, 0x314f5b, 0.1, 0.47, 0.39, 0.3, 0.26);
  cameraLens.rotation.x = Math.PI / 2;
  const glassLens = cylinder(camera, 0xa6d6de, 0.1, 0.47, 0.536, 0.19, 0.024);
  glassLens.rotation.x = Math.PI / 2;
  box(camera, C.cream, -0.31, 0.89, 0, 0.23, 0.14, 0.24);
  rod(camera, 0x7c6f74, [-0.5, 0.7, 0], [-0.7, 1.1, -0.05], 0.025);
  rod(camera, 0x7c6f74, [-0.7, 1.1, -0.05], [0.64, 1.1, -0.05], 0.025);
  rod(camera, 0x7c6f74, [0.64, 1.1, -0.05], [0.5, 0.7, 0], 0.025);
  interact('camera', 'pickup', '带上相机', 115, 2, camera, 'inside', 2.4, 2);

  function stairs(floor, destination, triggerZ, startZ, direction) {
    const parent = floors[floor].group;
    const up = destination > floor;
    const stair = place(parent, 6.85, startZ, 0);
    const run = up ? 4.8 : 5;
    for (let step = 0; step < 12; step++) {
      const y = (step + 1) * 0.38 * (up ? 1 : -1);
      const z = direction * (step + 0.5) * run / 12;
      box(stair, step % 2 ? 0xf9d67f : 0xffe29a, 0, y - 0.07, z, 1.08, 0.14, run / 12 + 0.015);
      box(stair, 0xd8bd7b, 0, y - (up ? 0.25 : -0.11), z - direction * run / 24, 1.08, 0.36, 0.07);
    }
    for (const side of [-1, 1]) {
      const x = side * 0.57;
      for (let post = 0; post < 5; post++) {
        const z = direction * (0.18 + post * run / 4.3);
        const y = (up ? 1 : -1) * Math.abs(z) / run * 4.56;
        rod(stair, C.wood, [x, y, z], [x, y + 1.02, z], 0.035);
      }
      rod(stair, 0xa78b63, [x, 1.08, 0], [x, (up ? 4.56 : -4.56) + 1.08, direction * run], 0.055);
    }
    if (up) {
      footprint(floor, 6.24, startZ + direction * run / 2, 0.08, run);
    } else {
      for (const x of [6.24, 7.46]) {
        rod(parent, 0xa78b63, [x, 1.04, 4.2], [x, 1.04, 9.2], 0.055);
        for (const z of [4.2, 5.45, 6.7, 7.95, 9.2]) rod(parent, C.wood, [x, 0, z], [x, 1.04, z], 0.035);
        footprint(floor, x, 6.7, 0.08, 5);
      }
    }
    const marker = place(parent, 8, triggerZ, 0);
    box(marker, up ? 0xffdf79 : 0xb6aedf, 0, 0.027, 0, 1.16, 0.035, 1.06);
    const arrow = flat(marker, triangleGeometry, C.white, 0, 0.055, 0, 0.62);
    arrow.rotation.x = up ? Math.PI / 2 : -Math.PI / 2;
    const id = `stairs-${floor}-${up ? 'up' : 'down'}`;
    const item = interact(id, 'stairs', up ? '上楼看看' : '下楼看看', 128, triggerZ, marker, 'inside', 1.8, floor);
    item.targetFloor = destination;
    item.arrival = { x: 128, z: 1 };
  }
  stairs(0, 1, 3.3, 1.8, -1);
  stairs(1, 0, 6.5, 4.2, 1);
  stairs(1, 2, -3.3, -4.5, -1);
  stairs(2, 1, 6.5, 4.2, 1);

  return { floors, bounds: { minX: 110, maxX: 130, minZ: -10, maxZ: 10 } };
}
