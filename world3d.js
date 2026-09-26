import * as THREE from 'three';
import { createPig, createCar } from './models3d.js';
import { buildHomeExterior } from './home-exterior.js';
import { buildHomeInterior } from './home-interior.js';

const COLORS = {
  grass: 0x91c861, sand: 0xf4dfa0, cream: 0xffefc1, yellow: 0xf8d866,
  coral: 0xe66867, teal: 0x294c52, wood: 0xb57b50, pink: 0xf1a3bf,
};
const UP = new THREE.Vector3(0, 1, 0);
const clamp = THREE.MathUtils.clamp;
const smooth = (a, b, value) => {
  const t = clamp((value - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export function createWorld() {
  const group = new THREE.Group();
  group.name = 'Vacation world';
  const exterior = new THREE.Group();
  exterior.name = 'Outside';
  const interior = new THREE.Group();
  interior.name = 'Inside the family home';
  group.add(exterior, interior);
  interior.visible = false;
  const colliders = [];
  const interactables = [];
  const clouds = [];
  const ducks = [];
  const wavelets = [];
  const materialCache = new Map();
  const windowMaterials = new Map();
  const windowGlows = [];
  const practicalLights = [];
  const nightWindowColor = new THREE.Color(0xffd394);
  const practicalGlow = { emissive: 0xffd394, emissiveIntensity: 0 };
  const geometry = {
    box: new THREE.BoxGeometry(1, 1, 1),
    ball: new THREE.SphereGeometry(1, 16, 10),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 12),
    cone: new THREE.ConeGeometry(1, 1, 12),
  };

  function material(color, extra = {}) {
    const key = `${color}:${JSON.stringify(extra)}`;
    if (!materialCache.has(key)) {
      materialCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.92, ...extra }));
    }
    return materialCache.get(key);
  }
  function mesh(parent, shape, color, x, y, z, sx = 1, sy = 1, sz = 1, extra) {
    const result = new THREE.Mesh(shape, material(color, extra));
    result.position.set(x, y, z);
    result.scale.set(sx, sy, sz);
    result.castShadow = true;
    result.receiveShadow = true;
    parent.add(result);
    return result;
  }
  const box = (p, c, x, y, z, w, h, d, e) => mesh(p, geometry.box, c, x, y, z, w, h, d, e);
  const ball = (p, c, x, y, z, w, h = w, d = w, e) => mesh(p, geometry.ball, c, x, y, z, w, h, d, e);
  const cylinder = (p, c, x, y, z, r, h, e) => mesh(p, geometry.cylinder, c, x, y, z, r, h, r, e);
  function rod(parent, color, start, end, radius = 0.07) {
    const a = new THREE.Vector3(...start);
    const b = new THREE.Vector3(...end);
    const direction = b.clone().sub(a);
    const result = cylinder(parent, color, 0, 0, 0, radius, direction.length());
    result.position.copy(a.add(b).multiplyScalar(0.5));
    result.quaternion.setFromUnitVectors(UP, direction.normalize());
    return result;
  }
  function terrainHeight(x, z, floor = 0) {
    if (x > 90) return floor * 4.8;
    const home = 2.9 * Math.exp(-(x * x / 360 + z * z / 300));
    const north = 1.35 * Math.exp(-((x + 24) ** 2 / 420 + (z + 22) ** 2 / 350));
    const camp = 1.15 * Math.exp(-((x - 19) ** 2 / 210 + (z + 23) ** 2 / 270));
    let height = 0.3 + home + north + camp + 0.13 * Math.sin(x * 0.15) * Math.cos(z * 0.14);
    const pondDistance = Math.hypot((x + 21) / 1.15, z - 34);
    height = THREE.MathUtils.lerp(0.24, height, smooth(4.8, 9, pondDistance));
    height = THREE.MathUtils.lerp(height, 0.22, smooth(23, 32, x));
    return height - smooth(48, 54, x) * 1.1;
  }
  function place(parent, x, z, y = terrainHeight(x, z)) {
    const result = new THREE.Group();
    result.position.set(x, y, z);
    parent.add(result);
    return result;
  }
  function collider(x, z, width, depth, zone = 'outside', floor = 0) {
    colliders.push({ minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2, zone, floor });
  }
  function interact(id, type, label, x, z, object, zone = 'outside', radius = 2.4, floor = 0) {
    object.name = id;
    const item = { id, type, label, position: new THREE.Vector3(x, terrainHeight(x, z, floor), z), zone, floor, radius, mesh: object };
    interactables.push(item);
    return item;
  }
  function groundPatch(parent, x, z, rx, rz, color, lift = 0.025, segments = 48) {
    const positions = [x, terrainHeight(x, z) + lift, z];
    const indices = [];
    for (let i = 0; i <= segments; i++) {
      const a = i / segments * Math.PI * 2;
      const px = x + Math.cos(a) * rx;
      const pz = z + Math.sin(a) * rz;
      positions.push(px, terrainHeight(px, pz) + lift, pz);
      if (i < segments) indices.push(0, i + 2, i + 1);
    }
    const shape = new THREE.BufferGeometry();
    shape.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    shape.setIndex(indices);
    shape.computeVertexNormals();
    const result = new THREE.Mesh(shape, material(color));
    result.receiveShadow = true;
    parent.add(result);
    return result;
  }
  function path(points, width = 2.3) {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)));
    const steps = Math.ceil(curve.getLength() * 2.5);
    const vertices = [];
    const indices = [];
    for (let i = 0; i <= steps; i++) {
      const point = curve.getPoint(i / steps);
      const tangent = curve.getTangent(i / steps);
      for (const side of [-1, 1]) {
        const x = point.x + tangent.z * width / 2 * side;
        const z = point.z - tangent.x * width / 2 * side;
        vertices.push(x, terrainHeight(x, z) + 0.045, z);
      }
      if (i < steps) {
        const n = i * 2;
        indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
      }
    }
    const shape = new THREE.BufferGeometry();
    shape.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    shape.setIndex(indices);
    shape.computeVertexNormals();
    const result = new THREE.Mesh(shape, material(COLORS.cream, { side: THREE.DoubleSide }));
    result.receiveShadow = true;
    exterior.add(result);
  }
  function sign(parent, x, z, text, color = COLORS.teal, height = 2.5) {
    const result = place(parent, x, z);
    cylinder(result, COLORS.wood, 0, height / 2, 0, 0.085, height);
    box(result, color, 0, height, 0, 2.7, 0.9, 0.15);
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 160;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#fff8df';
        ctx.font = 'bold 62px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 256, 80, 475);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        const face = new THREE.Mesh(new THREE.PlaneGeometry(2.55, 0.8), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
        face.position.set(0, height, 0.081);
        result.add(face);
      }
    }
    return result;
  }

  // A sampled heightfield, shared with every walking and interaction position.
  const groundGeometry = new THREE.PlaneGeometry(154, 170, 154, 170);
  groundGeometry.rotateX(-Math.PI / 2);
  groundGeometry.translate(-23, 0, -5);
  const groundPositions = groundGeometry.attributes.position;
  const groundColors = [];
  const grassColor = new THREE.Color(COLORS.grass);
  const sandColor = new THREE.Color(COLORS.sand);
  const vertexColor = new THREE.Color();
  for (let i = 0; i < groundPositions.count; i++) {
    const x = groundPositions.getX(i);
    const z = groundPositions.getZ(i);
    groundPositions.setY(i, terrainHeight(x, z));
    vertexColor.copy(grassColor).lerp(sandColor, smooth(28, 31, x));
    const variation = 0.98 + 0.025 * Math.sin(x * 0.21 + z * 0.08);
    vertexColor.multiplyScalar(variation);
    groundColors.push(vertexColor.r, vertexColor.g, vertexColor.b);
  }
  groundGeometry.setAttribute('color', new THREE.Float32BufferAttribute(groundColors, 3));
  groundGeometry.computeVertexNormals();
  const terrain = new THREE.Mesh(groundGeometry, material(0xffffff, { vertexColors: true }));
  terrain.receiveShadow = true;
  exterior.add(terrain);
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(250, 230), material(0x65cbdc, { roughness: 0.48 }));
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(174, -0.08, -5);
  ocean.receiveShadow = true;
  exterior.add(ocean);
  for (let i = 0; i < 14; i++) {
    const wave = box(exterior, 0xd8f6ec, 50.5 + (i % 3) * 2.4, -0.04, -45 + i * 6.7, 0.14, 0.015, 3.5 + i % 4);
    wave.castShadow = false;
    wavelets.push({ mesh: wave, x: wave.position.x, phase: i * 0.7 });
  }
  path([[0, 5.3], [0, 10], [4, 14], [11, 19], [22, 20], [34, 18]], 2.8);
  path([[0, 11], [-9, 11], [-17, 10], [-24, 9]], 2.2);
  path([[-22, 10], [-29, 0], [-25, -10], [-23, -17]], 2.1);
  path([[3, 10], [8, 2], [11, -8], [18, -14], [23, -20]], 2.2);
  path([[-8, 13], [-10, 22], [-15, 27], [-18, 29]], 1.9);
  path([[33, 3], [32, 11], [33, 22], [34, 32]], 1.3);

  // Only registered panes receive a shared glow material; other blue objects stay unchanged.
  function registerWindow(pane) {
    const source = pane.material;
    let glow = windowMaterials.get(source);
    if (!glow) {
      glow = source.clone();
      glow.emissive.copy(nightWindowColor);
      glow.emissiveIntensity = 0;
      windowMaterials.set(source, glow);
      windowGlows.push({ material: glow, dayColor: source.color });
    }
    pane.material = glow;
    return pane;
  }

  function window(parent, x, y, z, side = false) {
    const frame = new THREE.Group();
    frame.position.set(x, y, z);
    if (side) frame.rotation.y = Math.PI / 2;
    parent.add(frame);
    box(frame, 0xfff8df, 0, 0, 0, 1.92, 2.05, 0.16);
    registerWindow(box(frame, 0x97dceb, 0, 0, 0.1, 1.57, 1.7, 0.08));
    box(frame, 0xfff8df, 0, 0, 0.16, 0.105, 1.75, 0.06);
    box(frame, 0xfff8df, 0, 0, 0.16, 1.65, 0.105, 0.06);
    box(frame, 0xfff8df, 0, -1.08, 0.12, 2.12, 0.14, 0.35);
    return frame;
  }
  const homeContext = { exterior, interior, place, box, ball, cylinder, rod, material, window, registerWindow, collider, interact };
  const { exteriorSpawn, approach } = buildHomeExterior(homeContext);
  const mailbox = place(exterior, 5.8, 6.7);
  cylinder(mailbox, 0xf3eee0, 0, 0.7, 0, 0.12, 1.4);
  box(mailbox, 0x62a7bd, 0, 1.6, 0, 0.95, 0.65, 0.65);
  box(mailbox, 0xffefd1, 0, 1.67, 0.34, 0.55, 0.07, 0.025);
  box(mailbox, COLORS.coral, 0.57, 1.94, 0, 0.17, 0.55, 0.12);

  const practicalGlass = material(0xffedc8, practicalGlow);
  function pathLamp(x, z, name) {
    const fixture = place(exterior, x, z);
    fixture.name = name;
    cylinder(fixture, COLORS.teal, 0, 0.12, 0, 0.24, 0.24);
    cylinder(fixture, COLORS.teal, 0, 1.35, 0, 0.075, 2.7);
    cylinder(fixture, COLORS.teal, 0, 2.68, 0, 0.32, 0.12);
    const bulb = ball(fixture, 0xffedc8, 0, 3.02, 0, 0.25, 0.34, 0.25, practicalGlow);
    bulb.castShadow = false;
    mesh(fixture, geometry.cone, COLORS.teal, 0, 3.42, 0, 0.46, 0.25, 0.46);
    ball(fixture, COLORS.teal, 0, 3.59, 0, 0.085);
    const light = new THREE.PointLight(0xffd394, 0, 12, 2);
    light.position.set(0, 3.02, 0);
    light.castShadow = false;
    fixture.add(light);
    practicalLights.push(light);
  }
  pathLamp(9.8, 5.6, 'Entrance path lamp');

  function fence(points) {
    for (let i = 0; i < points.length; i++) {
      const [x, z] = points[i];
      const y = terrainHeight(x, z);
      box(exterior, 0xfff0cf, x, y + 0.72, z, 0.16, 1.44, 0.16);
      ball(exterior, 0xfff0cf, x, y + 1.45, z, 0.13);
      if (i) {
        const [px, pz] = points[i - 1];
        for (const h of [0.48, 1.06]) rod(exterior, 0xfff0cf, [px, terrainHeight(px, pz) + h, pz], [x, y + h, z], 0.065);
      }
    }
  }
  fence([[-8, 5], [-8, 2], [-8, -1], [-8, -4], [-8, -7], [-5, -7], [-2, -7], [1, -7], [4, -7], [7, -7], [8, -4], [8, -1], [8, 2], [8, 5]]);
  fence([[-34, 11], [-34, 8], [-34, 5], [-34, 2], [-34, -1], [-31, -1], [-28, -1], [-25, -1], [-22, -1]]);
  function flower(parent, x, y, z, color, size = 1) {
    cylinder(parent, 0x548e45, x, y + 0.32 * size, z, 0.035 * size, 0.62 * size);
    const leaf = ball(parent, 0x70ad50, x + 0.14 * size, y + 0.27 * size, z, 0.21 * size, 0.07 * size, 0.1 * size);
    leaf.rotation.z = 0.35;
    for (let k = 0; k < 5; k++) {
      const a = k * Math.PI * 2 / 5;
      ball(parent, color, x + Math.cos(a) * 0.16 * size, y + 0.68 * size + Math.sin(a) * 0.16 * size, z, 0.15 * size, 0.16 * size, 0.075 * size);
    }
    ball(parent, 0xffd264, x, y + 0.68 * size, z + 0.08 * size, 0.105 * size);
  }
  for (const side of [-1, 1]) {
    const planter = place(exterior, side * 4.2, 6.2);
    box(planter, 0xc88966, 0, 0.18, 0, 2.3, 0.35, 0.7);
    for (let i = 0; i < 5; i++) flower(planter, (i - 2) * 0.39, 0.3, 0, [0xe95a76, 0xffe8ac, 0x9b83d8][i % 3], 0.75);
  }

  // Family members are full characters, not interaction markers.
  for (const [id, label, x, z, dress, scale, glasses] of [
    ['mom', '猪妈妈', -5.8, 10, 0xef9754, 1.16, false],
    ['dad', '猪爸爸', 7, 9, 0x56aeb1, 1.35, true],
    ['george', '乔治', -8, 12, 0x6b9fe5, 0.7, false],
    ['grandpa', '猪爷爷', -22, 9, 0x9074bb, 1.2, false],
  ]) {
    const pig = createPig({ dress, scale, glasses, boots: false });
    pig.position.set(x, terrainHeight(x, z), z);
    pig.rotation.y = id === 'dad' ? -0.3 : id === 'grandpa' ? 0.65 : 0.1;
    exterior.add(pig);
    if (id === 'grandpa') {
      // The model is already scaled: the hat uses its unscaled head coordinates.
      cylinder(pig, 0x495d93, 0, 2.54, -0.04, 0.66, 0.16);
      cylinder(pig, 0x495d93, 0, 2.75, -0.04, 0.44, 0.33);
      box(pig, 0xffd76c, 0, 2.74, 0.405, 0.2, 0.12, 0.035);
    }
    interact(id, 'npc', label, x, z, pig, 'outside', 3.2);
  }
  const dinosaur = place(exterior, -18, 4);
  ball(dinosaur, 0x65bd78, 0, 0.51, 0, 0.45, 0.47, 0.65);
  ball(dinosaur, 0x65bd78, 0, 0.93, 0.42, 0.35, 0.46, 0.31);
  ball(dinosaur, 0x78cd83, 0, 1.09, 0.67, 0.35, 0.24, 0.42);
  rod(dinosaur, 0x65bd78, [0, 0.44, -0.3], [0.13, 0.69, -1.05], 0.16);
  for (const s of [-1, 1]) {
    ball(dinosaur, 0x59aa68, s * 0.3, 0.13, 0.2, 0.17, 0.13, 0.3);
    ball(dinosaur, 0xffffff, s * 0.25, 1.21, 0.66, 0.095);
    ball(dinosaur, COLORS.teal, s * 0.3, 1.21, 0.71, 0.045);
  }
  for (let i = 0; i < 4; i++) mesh(dinosaur, geometry.cone, 0xf8d866, 0, 0.82 - i * 0.055, -0.12 - i * 0.18, 0.11, 0.24, 0.11);
  interact('dinosaur', 'pickup', '乔治的恐龙', -18, 4, dinosaur);

  // Grandpa's vegetable garden, with visibly different plants and collectables.
  for (const [i, x, z] of [[1, -23, 2], [2, -26, 4], [3, -23, 6]]) {
    groundPatch(exterior, x, z, 1.35, 0.85, 0xa57951);
    const bed = place(exterior, x, z);
    const bloom = new THREE.Group();
    bed.add(bloom);
    for (let k = 0; k < 5; k++) flower(bloom, (k - 2) * 0.43, 0, Math.sin(k * 2) * 0.25, [0xef819f, 0xb798db, 0xffd268][i - 1], 0.8);
    bed.userData.bloom = bloom;
    interact(`flower-${i}`, 'water', '给花儿浇水', x, z, bed);
  }
  for (let i = 1; i <= 3; i++) {
    const x = -24 - i * 2;
    const z = 8;
    groundPatch(exterior, x, z, 0.78, 1.1, 0xa57951);
    const carrot = place(exterior, x, z);
    const root = mesh(carrot, geometry.cone, 0xf0933c, 0, 0.43, 0, 0.27, 0.84, 0.27);
    root.rotation.z = Math.PI;
    for (let k = 0; k < 5; k++) {
      const leaf = ball(carrot, k % 2 ? 0x5c9b46 : 0x79b955, Math.sin(k * 2.2) * 0.16, 0.99, Math.cos(k * 2.2) * 0.15, 0.12, 0.42, 0.09);
      leaf.rotation.z = Math.sin(k * 2.2) * 0.45;
    }
    interact(`carrot-${i}`, 'collect', '拔胡萝卜', x, z, carrot);
  }
  const wateringCan = place(exterior, -29, 3);
  cylinder(wateringCan, 0x73bbc1, 0, 0.45, 0, 0.4, 0.75);
  rod(wateringCan, 0x73bbc1, [0.3, 0.35, 0], [0.85, 0.8, 0], 0.12);
  const canHandle = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.065, 6, 16), material(0x73bbc1));
  canHandle.position.set(-0.25, 0.85, 0);
  wateringCan.add(canHandle);
  sign(exterior, -31, 12, '爷爷的花园', 0x69956a, 2.2);

  const puddleRoot = place(exterior, -12, 19);
  const puddleSurface = groundPatch(exterior, -12, 19, 3.7, 2.75, 0x946349, 0.055);
  puddleSurface.material = material(0x946349, { roughness: 0.36 });
  exterior.remove(puddleSurface);
  puddleSurface.position.copy(puddleRoot.position).multiplyScalar(-1);
  puddleRoot.add(puddleSurface);
  for (const [x, z, rx, rz] of [[-13.4, 18.9, 0.9, 0.32], [-11.1, 19.7, 1.0, 0.21], [-12.2, 17.8, 0.58, 0.18]]) {
    const sheen = groundPatch(exterior, x, z, rx, rz, 0xbc9270, 0.07, 24);
    exterior.remove(sheen);
    sheen.position.copy(puddleRoot.position).multiplyScalar(-1);
    puddleRoot.add(sheen);
  }
  interact('puddle', 'puddle', '跳进泥坑', -12, 19, puddleRoot, 'outside', 3.7);

  // A swing with a real suspended seat, a curved slide and a pivoting seesaw.
  const swing = place(exterior, -23, -18);
  for (const side of [-1, 1]) {
    rod(swing, 0xe8846d, [side * 2.25, 0, -1.3], [side * 2.0, 5.2, 0], 0.13);
    rod(swing, 0xe8846d, [side * 2.25, 0, 1.3], [side * 2.0, 5.2, 0], 0.13);
    collider(-23 + side * 2.25, -19.3, 0.45, 0.5);
    collider(-23 + side * 2.25, -16.7, 0.45, 0.5);
  }
  rod(swing, 0xf5ba63, [-2.3, 5.2, 0], [2.3, 5.2, 0], 0.15);
  const swingPivot = new THREE.Group();
  swingPivot.position.y = 5.08;
  swing.add(swingPivot);
  for (const side of [-1, 1]) rod(swingPivot, 0xede6cc, [side * 0.65, 0, 0], [side * 0.65, -3.65, 0], 0.037);
  box(swingPivot, 0x72b9ca, 0, -3.65, 0, 1.7, 0.17, 0.76);
  swing.userData.seat = swingPivot;
  swing.userData.seatPosition = new THREE.Vector3(0, -3.55, 0);
  interact('swing', 'swing', '荡秋千', -23, -18, swing);

  const slide = place(exterior, -30, -21);
  const slideLocal = [new THREE.Vector3(0, 4.4, -2.3), new THREE.Vector3(0, 4.2, -1.55), new THREE.Vector3(0, 3.1, -0.5), new THREE.Vector3(0, 1.4, 1.1), new THREE.Vector3(0, 0.3, 2.65), new THREE.Vector3(0, 0.2, 3.3)];
  const slideCurve = new THREE.CatmullRomCurve3(slideLocal);
  const slidePoints = slideCurve.getPoints(32);
  for (let i = 0; i < slidePoints.length - 1; i++) {
    const a = slidePoints[i];
    const b = slidePoints[i + 1];
    const section = box(slide, 0xed7771, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, 1.55, 0.14, a.distanceTo(b) + 0.05);
    section.rotation.x = -Math.atan2(b.y - a.y, b.z - a.z);
  }
  for (const side of [-1, 1]) {
    const railCurve = new THREE.CatmullRomCurve3(slidePoints.map(p => new THREE.Vector3(side * 0.78, p.y + 0.17, p.z)));
    const rail = new THREE.Mesh(new THREE.TubeGeometry(railCurve, 32, 0.095, 6, false), material(0xffd064));
    rail.castShadow = true;
    slide.add(rail);
    rod(slide, 0x75b3bf, [side * 0.7, 0, -3.9], [side * 0.7, 4.4, -2.3], 0.085);
    rod(slide, 0x75b3bf, [side * 0.7, 0, -2.1], [side * 0.7, 4.4, -2.1], 0.085);
    rod(slide, 0xffd064, [side * 0.9, 4.35, -2.95], [side * 0.9, 5.1, -2.95], 0.07);
    rod(slide, 0xffd064, [side * 0.9, 5.1, -2.95], [side * 0.9, 5.1, -1.9], 0.07);
  }
  for (let i = 1; i <= 8; i++) {
    const t = i / 9;
    rod(slide, 0xffd064, [-0.7, t * 4.4, -3.9 + t * 1.6], [0.7, t * 4.4, -3.9 + t * 1.6], 0.085);
  }
  box(slide, 0x75b3bf, 0, 4.3, -2.6, 1.8, 0.16, 1.1);
  collider(-30, -23.65, 1.65, 1.0);
  slide.userData.slidePath = slidePoints.map(p => p.clone().add(slide.position).add(new THREE.Vector3(0, 0.22, 0)));
  interact('slide', 'slide', '玩滑梯', -30, -21, slide);

  const seesaw = place(exterior, -17, -23);
  mesh(seesaw, geometry.cone, 0x76adb9, 0, 0.67, 0, 0.65, 1.3, 0.65);
  const beam = new THREE.Group();
  beam.position.y = 1.35;
  seesaw.add(beam);
  box(beam, 0xf2bd5f, 0, 0, 0, 6.2, 0.22, 0.52);
  for (const side of [-1, 1]) {
    box(beam, 0xeb827c, side * 2.55, 0.14, 0, 1.05, 0.16, 0.8);
    rod(beam, 0x6b9eae, [side * 1.95, 0.1, 0], [side * 1.95, 0.9, 0], 0.065);
    rod(beam, 0x6b9eae, [side * 1.95, 0.9, -0.32], [side * 1.95, 0.9, 0.32], 0.065);
  }
  seesaw.userData.beam = beam;
  collider(-17, -23, 0.8, 0.8);
  interact('seesaw', 'seesaw', '玩跷跷板', -17, -23, seesaw);
  sign(exterior, -19, -14, '山坡游乐场', 0xe89472, 2.35);

  const kite = place(exterior, 18, -14);
  cylinder(kite, 0xd2a875, 0, 1.9, 0, 0.075, 3.8);
  rod(kite, 0xfff4dc, [0, 3.8, 0], [1.05, 6.2, 0], 0.015);
  const diamond = new THREE.Group();
  diamond.position.set(1.05, 6.2, 0);
  diamond.rotation.z = -0.2;
  kite.add(diamond);
  const corners = [[0, 1.3, 0], [0.9, 0, 0], [0, -1.1, 0], [-0.9, 0, 0]];
  for (let i = 0; i < 4; i++) {
    const shape = new THREE.BufferGeometry();
    shape.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, ...corners[i], ...corners[(i + 1) % 4]], 3));
    shape.computeVertexNormals();
    diamond.add(new THREE.Mesh(shape, material([0xed827e, 0xf5d369, 0x73b8ca, 0x9abe72][i], { side: THREE.DoubleSide })));
  }
  rod(diamond, 0xf5e2be, [-0.9, 0, 0.03], [0.9, 0, 0.03], 0.025);
  rod(diamond, 0xf5e2be, [0, -1.1, 0.03], [0, 1.3, 0.03], 0.025);
  for (let i = 0; i < 5; i++) {
    rod(diamond, 0xfff2db, [Math.sin(i) * 0.2, -1.1 - i * 0.38, 0], [Math.sin(i + 1) * 0.2, -1.48 - i * 0.38, 0], 0.016);
    const bow = box(diamond, i % 2 ? 0xf4c867 : 0xe98693, Math.sin(i + 1) * 0.2, -1.48 - i * 0.38, 0, 0.34, 0.15, 0.04);
    bow.rotation.z = i % 2 ? 0.3 : -0.25;
  }
  interact('kite', 'kite', '放风筝', 18, -14, kite);
  const car = createCar();
  car.position.set(9, terrainHeight(9, 15), 15);
  car.rotation.y = Math.PI / 2;
  exterior.add(car);
  interact('car', 'car', '坐上红色小汽车', 9, 15, car);

  // Beach arrivals, shells, buckets, sandcastle and a real seaside scene.
  const beachArrival = sign(exterior, 34, 18, '阳光海滩', 0x63aebc, 2.35);
  interact('beach-arrival', 'arrival', '到达海滩', 34, 18, beachArrival, 'outside', 5);
  for (const [i, x, z] of [[1, 36, 4], [2, 41, 9], [3, 37, 15], [4, 43, 24], [5, 36, 29]]) {
    const shell = place(exterior, x, z);
    const shade = [0xffefce, 0xf3b5a7, 0xffe5b3, 0xe9b9cf, 0xfff3df][i - 1];
    ball(shell, shade, 0, 0.2, 0.2, 0.64, 0.2, 0.63);
    for (let r = -3; r <= 3; r++) {
      const a = r * 0.32;
      rod(shell, 0xfff8e6, [0, 0.3, -0.28], [Math.sin(a) * 0.66, 0.22, Math.cos(a) * 0.69], 0.025);
    }
    shell.rotation.y = i * 0.75;
    interact(`shell-${i}`, 'collect', '捡起贝壳', x, z, shell);
  }
  for (const [i, x, z] of [[1, 33, 8], [2, 34, 12], [3, 32, 16]]) {
    const bucket = place(exterior, x, z);
    const bucketShape = new THREE.CylinderGeometry(0.46, 0.32, 0.68, 14, 1, true);
    const body = mesh(bucket, bucketShape, [0xe9957b, 0x73bdce, 0xf2c768][i - 1], 0, 0.37, 0, 1, 1, 1, { side: THREE.DoubleSide });
    body.receiveShadow = true;
    cylinder(bucket, 0xeccf8b, 0, 0.67, 0, 0.405, 0.045);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.038, 6, 16, Math.PI), material(0xfff4d3));
    handle.position.y = 0.65;
    bucket.add(handle);
    const spade = box(bucket, 0xf3c361, 0.65, 0.38, 0.05, 0.16, 0.7, 0.08);
    spade.rotation.z = -0.38;
    ball(bucket, 0xf3c361, 0.79, 0.11, 0.05, 0.2, 0.25, 0.055);
    interact(`sand-${i}`, 'collect', '装一桶细沙', x, z, bucket);
  }
  const sandcastle = place(exterior, 39, 19);
  ball(sandcastle, 0xe8cc8e, 0, 0.075, 0, 2.35, 0.11, 1.8);
  const castleParts = [];
  const centerCastle = new THREE.Group();
  box(centerCastle, 0xe9c982, 0, 0.85, 0, 2.4, 1.7, 1.75);
  box(centerCastle, 0x99784d, 0, 0.48, 0.884, 0.55, 0.96, 0.025);
  ball(centerCastle, 0x99784d, 0, 0.95, 0.883, 0.275, 0.25, 0.025);
  for (const x of [-0.9, -0.3, 0.3, 0.9]) {
    box(centerCastle, 0xf0d593, x, 1.85, 0.65, 0.38, 0.4, 0.43);
    box(centerCastle, 0xf0d593, x, 1.85, -0.65, 0.38, 0.4, 0.43);
  }
  castleParts.push(centerCastle);
  for (const side of [-1, 1]) {
    const tower = new THREE.Group();
    tower.position.set(side * 1.46, 0, 0);
    cylinder(tower, 0xf0d593, 0, 1.25, 0, 0.66, 2.5);
    cylinder(tower, 0xe4c079, 0, 2.44, 0, 0.73, 0.2);
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2;
      box(tower, 0xf0d593, Math.cos(a) * 0.57, 2.67, Math.sin(a) * 0.57, 0.28, 0.38, 0.28);
    }
    cylinder(tower, 0xb58b55, 0, 3.12, 0, 0.032, 0.95);
    box(tower, side < 0 ? 0xe99591 : 0x72b7c6, 0.24, 3.4, 0, 0.49, 0.33, 0.025);
    castleParts.push(tower);
  }
  for (const part of castleParts) {
    part.visible = false;
    sandcastle.add(part);
  }
  sandcastle.userData.castleParts = castleParts;
  interact('sandcastle', 'build', '建造沙堡', 39, 19, sandcastle);

  function parasol(x, z, color) {
    const shade = place(exterior, x, z);
    cylinder(shade, 0xffefce, 0, 1.9, 0, 0.06, 3.8);
    const canopy = mesh(shade, new THREE.ConeGeometry(2.35, 0.78, 12, 1, true), color, 0, 3.77, 0, 1, 1, 1, { side: THREE.DoubleSide });
    canopy.rotation.y = 0.15;
    ball(shade, 0xffeed0, 0, 4.17, 0, 0.13);
    for (const side of [-1, 1]) {
      const towel = box(shade, side < 0 ? 0xf4edc9 : 0x8fc9cc, side * 1.1, 0.04, 0.75, 0.95, 0.045, 2.1);
      towel.rotation.y = side * 0.13;
    }
    collider(x, z, 0.2, 0.2);
  }
  parasol(43, 13, 0xe9969a);
  parasol(41, 31, 0x78b6cb);
  const lifebuoy = place(exterior, 46, 21);
  const lifeRing = new THREE.Mesh(new THREE.TorusGeometry(0.69, 0.18, 8, 20), material(0xfff2d5));
  lifeRing.rotation.x = -Math.PI / 2;
  lifeRing.position.y = 0.22;
  lifebuoy.add(lifeRing);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    const band = box(lifebuoy, 0xe67f73, Math.cos(a) * 0.69, 0.22, Math.sin(a) * 0.69, 0.36, 0.34, 0.32);
    band.rotation.y = -a;
  }
  function photoSign(id, x, z, label) {
    const post = sign(exterior, x, z, label, 0x638ca7, 2.6);
    box(post, 0xfff1d6, 0, 3.45, 0, 0.9, 0.62, 0.15);
    box(post, 0xfff1d6, -0.2, 3.81, 0, 0.35, 0.15, 0.15);
    const lens = cylinder(post, 0x638ca7, 0, 3.45, 0.12, 0.22, 0.08);
    lens.rotation.x = Math.PI / 2;
    interact(id, 'photo', label, x, z, post);
  }
  photoSign('photo-beach', 35, 33, '海边合影');
  photoSign('photo-camp', 19, -25, '营地合影');

  // Camping meadow: a pitched fabric tent and a properly set picnic table.
  const tent = place(exterior, 25.5, -28);
  const tentGeo = new THREE.BufferGeometry();
  tentGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    -2.8, 0, 2.5, 0, 3.8, 2.5, -2.8, 0, -2.5, 0, 3.8, 2.5, 0, 3.8, -2.5, -2.8, 0, -2.5,
    0, 3.8, 2.5, 2.8, 0, 2.5, 2.8, 0, -2.5, 0, 3.8, 2.5, 2.8, 0, -2.5, 0, 3.8, -2.5,
    -2.8, 0, -2.5, 0, 3.8, -2.5, 2.8, 0, -2.5,
  ], 3));
  tentGeo.computeVertexNormals();
  const tentMesh = new THREE.Mesh(tentGeo, material(0xeab874, { side: THREE.DoubleSide }));
  tentMesh.castShadow = true;
  tentMesh.receiveShadow = true;
  tent.add(tentMesh);
  box(tent, 0x879b82, 0, 0.05, 0, 5.3, 0.08, 4.8);
  const flapGeometry = new THREE.BufferGeometry();
  flapGeometry.setAttribute('position', new THREE.Float32BufferAttribute([-2.8, 0, 2.51, 0, 3.8, 2.51, -1.12, 0, 2.51, 0, 3.8, 2.51, 2.8, 0, 2.51, 1.12, 0, 2.51], 3));
  flapGeometry.computeVertexNormals();
  const flap = new THREE.Mesh(flapGeometry, material(0xe99777, { side: THREE.DoubleSide }));
  flap.castShadow = true;
  tent.add(flap);
  rod(tent, 0xffe7bf, [0, 0, 2.6], [0, 3.9, 2.6], 0.06);
  for (const side of [-1, 1]) rod(tent, 0xffeed5, [side * 2.3, 0.65, 2], [side * 3.4, 0.05, 3.1], 0.02);
  collider(25.5, -28.5, 5.4, 3.8);
  const sleepingBag = box(tent, 0x7eaec2, -0.95, 0.2, -0.6, 1.4, 0.25, 2.8);
  sleepingBag.rotation.y = 0.05;
  box(tent, 0xf0e8ce, -0.95, 0.38, -1.5, 1.22, 0.21, 0.58);
  const picnic = place(exterior, 23, -20);
  box(picnic, 0xbc865b, 0, 1.55, 0, 3.8, 0.2, 2.0);
  for (const z of [-1.45, 1.45]) box(picnic, 0xcb9768, 0, 0.83, z, 4.15, 0.18, 0.56);
  for (const x of [-1.3, 1.3]) {
    rod(picnic, 0xa77958, [x, 0, -1.35], [x, 1.5, 0.6], 0.14);
    rod(picnic, 0xa77958, [x, 0, 1.35], [x, 1.5, -0.6], 0.14);
  }
  box(picnic, 0xffe9cb, 0, 1.67, 0, 1.5, 0.025, 1.98);
  for (const x of [-0.5, 0, 0.5]) box(picnic, 0xeeb0a3, x, 1.686, 0, 0.17, 0.008, 1.98);
  const food = new THREE.Group();
  picnic.add(food);
  food.visible = false;
  for (const x of [-1.05, 1.05]) {
    cylinder(food, 0xfff7dc, x, 1.7, 0.1, 0.44, 0.045);
    box(food, 0xf3ce84, x, 1.85, 0.1, 0.52, 0.18, 0.44);
    box(food, 0x89b566, x, 1.82, 0.1, 0.54, 0.045, 0.46);
  }
  cylinder(food, 0xeaa073, 0.1, 1.99, -0.42, 0.21, 0.64);
  cylinder(food, 0xfff5db, 0.1, 2.32, -0.42, 0.22, 0.06);
  for (const x of [-0.4, 0.55]) cylinder(food, 0x92c7cd, x, 1.88, 0.55, 0.13, 0.36);
  ball(food, 0xed8e83, 0.1, 1.83, 0.1, 0.18);
  picnic.userData.food = food;
  collider(23, -20, 3.75, 2.75);
  interact('picnic', 'picnic', '准备家庭野餐', 23, -20, picnic, 'outside', 3.3);
  sign(exterior, 16, -20, '星光营地', 0x8b91b5, 2.3);
  pathLamp(20.7, -23.5, 'Camp path lamp');

  // A shallow pond with reeds and three modelled ducks.
  groundPatch(exterior, -21, 34, 6.2, 4.85, 0xcfdb9b, 0.04);
  const pond = groundPatch(exterior, -21, 34, 5.55, 4.2, 0x79bdc6, 0.08);
  pond.material = material(0x79bdc6, { roughness: 0.43 });
  const duckRoot = place(exterior, -18, 31);
  for (let i = 0; i < 3; i++) {
    const duck = new THREE.Group();
    const wx = -21.8 + i * 1.45;
    const wz = 33.5 + Math.sin(i * 1.9) * 1.25;
    duck.position.set(wx + 18, terrainHeight(wx, wz) - duckRoot.position.y + 0.22, wz - 31);
    duck.rotation.y = i * 0.5 - 0.3;
    ball(duck, 0xffedb7, 0, 0.25, 0, 0.47, 0.31, 0.66);
    ball(duck, 0xffe9a8, 0, 0.66, 0.36, 0.3, 0.32, 0.31);
    ball(duck, 0xe8d598, 0.36, 0.34, -0.07, 0.12, 0.18, 0.39);
    ball(duck, 0xf1ab53, 0, 0.56, 0.69, 0.21, 0.09, 0.24);
    for (const side of [-1, 1]) ball(duck, COLORS.teal, side * 0.235, 0.74, 0.5, 0.039);
    duckRoot.add(duck);
    ducks.push({ mesh: duck, y: duck.position.y, angle: duck.rotation.y, phase: i * 2.1 });
  }
  interact('ducks', 'ducks', '给小鸭子喂食', -18, 31, duckRoot);
  for (const [x, z] of [[-26, 33], [-24, 37.5], [-18, 37.7], [-16.2, 33.5], [-24, 30.8]]) {
    const reeds = place(exterior, x, z);
    for (let i = 0; i < 4; i++) {
      const h = 0.9 + i * 0.19;
      rod(reeds, 0x739b57, [i * 0.15, 0, 0], [i * 0.19, h, 0.13 * Math.sin(i)], 0.026);
      cylinder(reeds, 0xa37a55, i * 0.19, h, 0.13 * Math.sin(i), 0.067, 0.3);
    }
  }
  sign(exterior, -13, 30, '小鸭池塘', 0x68a9ab, 2.1);

  for (const [i, x, z] of [[1, -4, 15], [2, 0, 18], [3, 4, 15]]) {
    const lantern = place(exterior, x, z);
    cylinder(lantern, 0x9f765d, 0, 1.7, 0, 0.065, 3.4);
    rod(lantern, 0x9f765d, [0, 3.35, 0], [0.6, 3.35, 0], 0.065);
    cylinder(lantern, 0xb58960, 0.52, 3.16, 0, 0.026, 0.35);
    ball(lantern, 0xffd592, 0.52, 2.72, 0, 0.42, 0.52, 0.42, { emissive: 0xffc06e, emissiveIntensity: 0.05 });
    cylinder(lantern, 0xc78a63, 0.52, 3.18, 0, 0.21, 0.08);
    cylinder(lantern, 0xc78a63, 0.52, 2.25, 0, 0.21, 0.08);
    const light = new THREE.PointLight(0xffca7d, 0, 11, 2);
    light.position.set(0.52, 2.7, 0);
    lantern.add(light);
    lantern.userData.light = light;
    interact(`lantern-${i}`, 'lantern', '点亮小灯笼', x, z, lantern);
  }
  const fireworks = place(exterior, 0, 22);
  box(fireworks, 0xb17a63, 0, 0.35, 0, 1.45, 0.7, 1.0);
  for (const x of [-0.46, 0, 0.46]) {
    cylinder(fireworks, 0x76616b, x, 0.86, 0, 0.145, 0.7);
    mesh(fireworks, geometry.cone, x ? 0xe98b8a : 0xf4ca6e, x, 1.29, 0, 0.19, 0.3, 0.19);
  }
  box(fireworks, 0xf5d38c, 0, 0.38, 0.51, 0.72, 0.28, 0.02);
  interact('fireworks', 'fireworks', '开启假日烟花', 0, 22, fireworks);

  // Round clustered treetops and distant scenery frame, rather than obstruct, play.
  function tree(x, z, scale, seed, pine = false) {
    const result = place(exterior, x, z);
    cylinder(result, 0xac835b, 0, 1.5 * scale, 0, 0.23 * scale, 3 * scale);
    if (pine) {
      for (let i = 0; i < 3; i++) mesh(result, geometry.cone, [0x72a66b, 0x83b570, 0x94c07c][i], 0, (2.5 + i * 0.9) * scale, 0, (1.7 - i * 0.3) * scale, 2.4 * scale, (1.7 - i * 0.3) * scale);
    } else {
      for (let i = 0; i < 4; i++) {
        const a = i * 2.1 + seed;
        ball(result, [0x78b360, 0x8dc56c, 0xa4cd75, 0x78b360][i], Math.cos(a) * 0.65 * scale, (3.45 + (i % 2) * 0.65) * scale, Math.sin(a) * 0.6 * scale, (1.5 - (i % 2) * 0.15) * scale, 1.6 * scale, 1.4 * scale);
      }
      if (seed % 3 === 0) {
        for (let i = 0; i < 4; i++) ball(result, 0xe98973, Math.cos(i * 1.9) * scale, (3.1 + i % 2 * 0.9) * scale, 1.02 * scale, 0.17 * scale);
      }
    }
    if (x > -48 && x < 47 && z > -43 && z < 44) collider(x, z, 0.6 * scale, 0.6 * scale);
  }
  const treePositions = [
    [-13,-8,1.1],[-18,-5,0.85],[-38,0,1.15],[-40,7,0.95],[-37,17,1.25],[-32,24,0.9],[-37,31,1.1],
    [-40,-15,1.3],[-36,-29,1.15],[-27,-32,0.95],[-18,-33,1.25],[-10,-28,1.0],[-6,-18,1.2],
    [9,-15,0.85],[11,-29,1.1],[18,-34,1.25],[29,-34,1.0],[31,-23,0.9],[27,-10,1.1],
    [16,4,1.0],[23,9,1.15],[22,28,0.95],[14,31,1.2],[4,35,1.0],[-5,33,0.85],[-30,40,1.2],
    [-43,-36,1.45],[-8,-40,1.3],[4,-35,0.95],[34,-39,1.3],[43,-16,0.9],[-44,39,1.35],
  ];
  treePositions.forEach(([x, z, scale], i) => tree(x, z, scale, i, i > 14 && i < 20));
  for (let i = 0; i < 13; i++) {
    const x = -77 + i * 10;
    const z = -66 - Math.sin(i * 1.7) * 7;
    ball(exterior, i % 2 ? 0x99c785 : 0x87b875, x, -1.5, z, 15 + i % 3 * 4, 8 + i % 4 * 2, 11);
  }
  for (let i = 0; i < 9; i++) {
    const cloud = new THREE.Group();
    cloud.position.set(-62 + i * 15, 24 + (i % 3) * 4, -45 - (i % 2) * 20);
    exterior.add(cloud);
    for (let k = 0; k < 5; k++) {
      const puff = ball(cloud, 0xfffdf0, (k - 2) * 1.85, Math.sin(k * 1.3) * 0.7, 0, 2.25, 1.45 + k % 2 * 0.5, 1.3);
      puff.castShadow = false;
      puff.receiveShadow = false;
    }
    clouds.push({ mesh: cloud, x: cloud.position.x, phase: i * 0.6 });
  }
  for (let i = 0; i < 28; i++) {
    const x = -43 + (i * 17 % 67);
    const z = -37 + (i * 23 % 71);
    if (Math.abs(x) < 12 && Math.abs(z) < 15) continue;
    const tuft = place(exterior, x, z);
    for (let k = 0; k < 3; k++) {
      const leaf = box(tuft, 0x79b158, (k - 1) * 0.12, 0.19, 0, 0.075, 0.38, 0.035);
      leaf.rotation.z = (k - 1) * 0.3;
    }
    if (i % 4 === 0) flower(tuft, 0.35, 0, 0, 0xfff0b2, 0.55);
  }

  const homeInterior = buildHomeInterior(homeContext);
  const floorSpawns = homeInterior.floors.map(item => item.spawn);
  const floorNames = homeInterior.floors.map(item => item.name);

  const bounds = {
    outside: { minX: -47, maxX: 46, minZ: -43, maxZ: 44 },
    inside: homeInterior.bounds,
  };
  const locations = [
    { id: 'home', name: '佩奇的家', x: approach.x, z: approach.z, color: '#f8d866' },
    { id: 'garden', name: '爷爷的花园', x: -25, z: 6, color: '#a3c778' },
    { id: 'playground', name: '山坡游乐场', x: -23, z: -21, color: '#e99586' },
    { id: 'beach', name: '阳光海滩', x: 36, z: 19, color: '#75c2d1' },
    { id: 'camp', name: '星光营地', x: 23, z: -23, color: '#aaa3cf' },
    { id: 'pond', name: '小鸭池塘', x: -21, z: 34, color: '#82bfc0' },
  ];
  function update(time, dt) {
    if (!exterior.visible) return;
    for (const cloud of clouds) cloud.mesh.position.x = cloud.x + Math.sin(time * 0.023 + cloud.phase) * 3;
    for (const duck of ducks) {
      duck.mesh.position.y = duck.y + Math.sin(time * 1.9 + duck.phase) * 0.045;
      duck.mesh.rotation.y = duck.angle + Math.sin(time * 0.24 + duck.phase) * 0.12;
    }
    for (const wave of wavelets) wave.mesh.position.x = wave.x + Math.sin(time * 0.6 + wave.phase) * 0.45;
  }
  function setNight(amount) {
    const night = clamp(amount, 0, 1);
    for (let i = 0; i < windowGlows.length; i++) {
      const glow = windowGlows[i];
      glow.material.color.copy(glow.dayColor).lerp(nightWindowColor, night);
      glow.material.emissiveIntensity = night * 0.55;
    }
    practicalGlass.emissiveIntensity = night * 0.85;
    for (let i = 0; i < practicalLights.length; i++) practicalLights[i].intensity = night * 28;
  }
  function setZone(zone, floor = 0) {
    exterior.visible = zone !== 'inside';
    interior.visible = zone === 'inside';
    homeInterior.floors.forEach((item, index) => { item.group.visible = index === floor; });
  }
  return {
    group, exterior, interior, terrainHeight, colliders, interactables,
    spawn: { x: 0, z: 13 }, interiorSpawn: floorSpawns[0], exteriorSpawn,
    floorSpawns, floorNames, bounds, locations, update, setZone, setNight,
  };
}
