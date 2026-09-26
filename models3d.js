import * as THREE from 'three';

const PALETTE = {
  pink: 0xf1a3bf,
  snout: 0xf5b0c8,
  cheek: 0xe477a1,
  innerEar: 0xe68cae,
  outline: 0x294c52,
  yellow: 0xf6cb4e,
  sole: 0xc89936,
  red: 0xe66867,
  cream: 0xffebc1,
};

const materials = new Map();
function matte(color) {
  if (!materials.has(color)) {
    materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.86, metalness: 0 }));
  }
  return materials.get(color);
}

const sphereGeometry = new THREE.SphereGeometry(1, 20, 14);
const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 20);
const glassesGeometry = new THREE.TorusGeometry(1, 0.075, 6, 28);
const dressGeometry = new THREE.LatheGeometry([
  new THREE.Vector2(0, 0.57),
  new THREE.Vector2(0.47, 0.57),
  new THREE.Vector2(0.64, 0.61),
  new THREE.Vector2(0.68, 0.70),
  new THREE.Vector2(0.65, 0.87),
  new THREE.Vector2(0.56, 1.15),
  new THREE.Vector2(0.43, 1.42),
  new THREE.Vector2(0.28, 1.53),
  new THREE.Vector2(0, 1.55),
], 24);

const roundedShape = new THREE.Shape();
roundedShape.moveTo(-0.28, -0.4);
roundedShape.lineTo(0.28, -0.4);
roundedShape.quadraticCurveTo(0.4, -0.4, 0.4, -0.28);
roundedShape.lineTo(0.4, 0.28);
roundedShape.quadraticCurveTo(0.4, 0.4, 0.28, 0.4);
roundedShape.lineTo(-0.28, 0.4);
roundedShape.quadraticCurveTo(-0.4, 0.4, -0.4, 0.28);
roundedShape.lineTo(-0.4, -0.28);
roundedShape.quadraticCurveTo(-0.4, -0.4, -0.28, -0.4);
const roundedBoxGeometry = new THREE.ExtrudeGeometry(roundedShape, {
  depth: 0.8,
  steps: 1,
  bevelEnabled: true,
  bevelThickness: 0.1,
  bevelSize: 0.1,
  bevelSegments: 2,
  curveSegments: 4,
});
roundedBoxGeometry.translate(0, 0, -0.4);

function tube(points, radius, segments = 24) {
  return new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point))),
    segments,
    radius,
    6,
    false,
  );
}

const smileGeometry = tube([
  [-0.30, 1.78, 0.56],
  [-0.21, 1.65, 0.59],
  [0, 1.60, 0.60],
  [0.21, 1.65, 0.59],
  [0.30, 1.78, 0.56],
], 0.022, 20);
const tailGeometry = tube([
  [0, 0.99, -0.58],
  [0.09, 1.00, -0.68],
  [0.19, 1.10, -0.76],
  [0.13, 1.21, -0.83],
  [-0.015, 1.18, -0.90],
  [-0.025, 1.06, -0.96],
  [0.10, 1.035, -1.00],
  [0.16, 1.12, -1.035],
], 0.029, 32);

const up = new THREE.Vector3(0, 1, 0);
function mesh(parent, geometry, material, position, scale, castShadow = true) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(...position);
  if (scale) item.scale.set(...scale);
  item.castShadow = castShadow;
  item.receiveShadow = true;
  parent.add(item);
  return item;
}

function ellipsoid(parent, color, position, scale, castShadow = true) {
  return mesh(parent, sphereGeometry, matte(color), position, scale, castShadow);
}

function box(parent, color, position, scale) {
  return mesh(parent, roundedBoxGeometry, matte(color), position, scale);
}

function rod(parent, color, from, to, radius) {
  const start = new THREE.Vector3(...from);
  const direction = new THREE.Vector3(...to).sub(start);
  const item = mesh(parent, cylinderGeometry, matte(color), [0, 0, 0], [radius, direction.length(), radius]);
  item.position.copy(start).addScaledVector(direction, 0.5);
  item.quaternion.setFromUnitVectors(up, direction.normalize());
  return item;
}

export function createPig({ dress = 0xe95a76, scale = 1, glasses = false, boots = true } = {}) {
  const pig = new THREE.Group();
  pig.name = 'pig';
  pig.scale.setScalar(scale);
  pig.userData.legs = [];
  pig.userData.arms = [];

  mesh(pig, dressGeometry, matte(dress), [0, 0, 0]);
  ellipsoid(pig, PALETTE.pink, [0, 1.91, 0.015], [0.64, 0.60, 0.54]);

  // Keep the muzzle on the head's forward axis so it reads correctly from every angle.
  ellipsoid(pig, PALETTE.pink, [0, 1.92, 0.52], [0.40, 0.27, 0.43]);
  ellipsoid(pig, PALETTE.snout, [0, 1.935, 0.90], [0.325, 0.225, 0.066]);
  for (const x of [-0.13, 0.13]) {
    ellipsoid(pig, 0xbe608a, [x, 1.945, 0.958], [0.033, 0.048, 0.019], false);
  }

  const eyePositions = [[-0.25, 2.245, 0.48], [0.25, 2.245, 0.48]];
  for (const [x, y, z] of eyePositions) {
    ellipsoid(pig, 0xfffdf8, [x, y, z], [0.15, 0.174, 0.076], false);
    ellipsoid(pig, PALETTE.outline, [x, y + 0.008, z + 0.070], [0.053, 0.065, 0.024], false);
    ellipsoid(pig, 0xffffff, [x + 0.003, y + 0.030, z + 0.093], [0.014, 0.016, 0.006], false);
  }

  const leftCheek = ellipsoid(pig, PALETTE.cheek, [-0.455, 1.91, 0.395], [0.135, 0.135, 0.037], false);
  leftCheek.rotation.y = -0.58;
  const rightCheek = ellipsoid(pig, PALETTE.cheek, [0.455, 1.91, 0.395], [0.135, 0.135, 0.037], false);
  rightCheek.rotation.y = 0.58;
  mesh(pig, smileGeometry, matte(0xb8557d), [0, 0, 0], null, false);

  for (const [x, tilt] of [[-0.30, 0.18], [0.30, -0.18]]) {
    const ear = new THREE.Group();
    ear.position.set(x, 2.495, -0.005);
    ear.rotation.z = tilt;
    pig.add(ear);
    ellipsoid(ear, PALETTE.pink, [0, 0, 0], [0.125, 0.255, 0.105]);
    ellipsoid(ear, PALETTE.innerEar, [0, 0.025, 0.084], [0.064, 0.165, 0.026], false);
  }

  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.name = side < 0 ? 'left-leg' : 'right-leg';
    leg.position.set(side * 0.285, 0.70, 0);
    pig.add(leg);
    pig.userData.legs.push(leg);
    rod(leg, PALETTE.pink, [0, -0.04, 0], [0, -0.47, 0], 0.066);
    if (boots) {
      mesh(leg, cylinderGeometry, matte(PALETTE.yellow), [0, -0.435, 0], [0.132, 0.29, 0.132]);
      ellipsoid(leg, PALETTE.yellow, [0, -0.53, 0.09], [0.18, 0.17, 0.285]);
      ellipsoid(leg, PALETTE.sole, [0, -0.67, 0.09], [0.185, 0.03, 0.29]);
      mesh(leg, cylinderGeometry, matte(PALETTE.sole), [0, -0.286, 0], [0.139, 0.035, 0.139]);
    } else {
      ellipsoid(leg, PALETTE.outline, [0, -0.57, 0.07], [0.16, 0.13, 0.255]);
    }

    const arm = new THREE.Group();
    arm.name = side < 0 ? 'left-arm' : 'right-arm';
    arm.position.set(side * 0.475, 1.35, 0.01);
    pig.add(arm);
    pig.userData.arms.push(arm);
    rod(arm, PALETTE.pink, [0, 0, 0], [side * 0.33, -0.22, 0.015], 0.045);
    ellipsoid(arm, PALETTE.pink, [side * 0.35, -0.235, 0.015], [0.080, 0.067, 0.060]);
    rod(arm, PALETTE.pink, [side * 0.35, -0.23, 0.015], [side * 0.455, -0.21, 0.01], 0.027);
    rod(arm, PALETTE.pink, [side * 0.35, -0.24, 0.015], [side * 0.43, -0.31, 0.025], 0.026);
    rod(arm, PALETTE.pink, [side * 0.34, -0.23, 0.02], [side * 0.36, -0.32, 0.085], 0.025);
  }

  mesh(pig, tailGeometry, matte(PALETTE.pink), [0, 0, 0]);

  if (glasses) {
    const frameColor = 0x353c41;
    for (const [x, y, z] of eyePositions) {
      mesh(pig, glassesGeometry, matte(frameColor), [x, y, z + 0.083], [0.176, 0.198, 0.176], false);
    }
    rod(pig, frameColor, [-0.074, 2.245, 0.563], [0.074, 2.245, 0.563], 0.017);
    rod(pig, frameColor, [-0.426, 2.245, 0.563], [-0.575, 2.20, 0.12], 0.016);
    rod(pig, frameColor, [0.426, 2.245, 0.563], [0.575, 2.20, 0.12], 0.016);
  }

  return pig;
}

const windowMaterial = new THREE.MeshStandardMaterial({
  color: 0x87cedb,
  roughness: 0.45,
  metalness: 0,
  transparent: true,
  opacity: 0.52,
  depthWrite: false,
});

export function createCar() {
  const car = new THREE.Group();
  car.name = 'family-vacation-car';
  car.userData.wheels = [];

  box(car, PALETTE.outline, [0, 0.57, 0], [2.30, 0.22, 3.72]);
  box(car, PALETTE.red, [0, 0.96, 0], [2.50, 0.84, 4.20]);
  box(car, PALETTE.red, [0, 1.35, 1.36], [2.36, 0.20, 1.34]);
  box(car, PALETTE.red, [0, 1.36, -1.69], [2.36, 0.20, 0.62]);
  box(car, PALETTE.cream, [0, 0.66, 2.13], [2.57, 0.15, 0.21]);
  box(car, PALETTE.cream, [0, 0.66, -2.13], [2.57, 0.15, 0.21]);

  for (const side of [-1, 1]) {
    for (const z of [-1.32, 1.32]) {
      const wheel = new THREE.Group();
      wheel.name = `${side < 0 ? 'left' : 'right'}-${z > 0 ? 'front' : 'rear'}-wheel`;
      wheel.position.set(side * 1.24, 0.46, z);
      car.add(wheel);
      car.userData.wheels.push(wheel);
      const tire = mesh(wheel, cylinderGeometry, matte(0x344449), [0, 0, 0], [0.46, 0.27, 0.46]);
      tire.rotation.z = Math.PI / 2;
      const hub = mesh(wheel, cylinderGeometry, matte(PALETTE.cream), [side * 0.142, 0, 0], [0.255, 0.027, 0.255]);
      hub.rotation.z = Math.PI / 2;
      const cap = mesh(wheel, cylinderGeometry, matte(0x85adb0), [side * 0.16, 0, 0], [0.09, 0.035, 0.09]);
      cap.rotation.z = Math.PI / 2;
      for (let bolt = 0; bolt < 4; bolt += 1) {
        const angle = bolt * Math.PI / 2;
        ellipsoid(wheel, PALETTE.outline, [side * 0.163, Math.cos(angle) * 0.166, Math.sin(angle) * 0.166], [0.012, 0.027, 0.027], false);
      }
    }
  }

  // Separate translucent panes leave the seats and steering wheel visible from close up.
  const windshield = mesh(car, roundedBoxGeometry, windowMaterial, [0, 1.735, 0.855], [2.08, 0.72, 0.045], false);
  windshield.rotation.x = -0.12;
  mesh(car, roundedBoxGeometry, windowMaterial, [0, 1.735, -1.425], [2.08, 0.72, 0.045], false);
  for (const side of [-1, 1]) {
    mesh(car, roundedBoxGeometry, windowMaterial, [side * 1.072, 1.735, -0.29], [0.045, 0.72, 2.18], false);
    box(car, PALETTE.red, [side * 1.08, 1.75, -1.425], [0.13, 0.84, 0.13]);
    const frontPillar = box(car, PALETTE.red, [side * 1.08, 1.75, 0.85], [0.13, 0.84, 0.13]);
    frontPillar.rotation.x = -0.12;
    box(car, PALETTE.red, [side * 1.10, 1.74, -0.35], [0.075, 0.77, 0.085]);
    box(car, PALETTE.cream, [side * 1.257, 1.17, -0.12], [0.045, 0.06, 0.24]);
    rod(car, PALETTE.outline, [side * 1.11, 1.53, 0.76], [side * 1.37, 1.53, 0.81], 0.035);
    box(car, PALETTE.red, [side * 1.40, 1.56, 0.81], [0.23, 0.18, 0.13]);
  }
  box(car, PALETTE.red, [0, 2.13, -0.29], [2.34, 0.17, 2.48]);

  for (const x of [-0.53, 0.53]) {
    box(car, 0xf5ce83, [x, 1.405, 0.06], [0.77, 0.17, 0.67]);
    const seatBack = box(car, 0xf5ce83, [x, 1.60, -0.23], [0.77, 0.65, 0.17]);
    seatBack.rotation.x = -0.10;
    box(car, PALETTE.cream, [x, 1.93, -0.25], [0.38, 0.21, 0.18]);
  }
  box(car, 0xf5ce83, [0, 1.41, -0.91], [1.76, 0.17, 0.49]);
  box(car, 0xf5ce83, [0, 1.68, -1.15], [1.76, 0.58, 0.15]);
  box(car, PALETTE.outline, [0, 1.51, 0.60], [1.93, 0.16, 0.30]);
  const steeringWheel = mesh(car, glassesGeometry, matte(PALETTE.outline), [-0.53, 1.69, 0.42], [0.22, 0.22, 0.22]);
  steeringWheel.rotation.x = -0.65;
  rod(car, PALETTE.outline, [-0.53, 1.51, 0.59], [-0.53, 1.69, 0.42], 0.035);

  for (const side of [-1, 1]) {
    ellipsoid(car, 0xffe7a0, [side * 0.83, 1.12, 2.089], [0.23, 0.17, 0.075], false);
    box(car, 0xbe465b, [side * 0.91, 1.11, -2.10], [0.25, 0.19, 0.075]);
    box(car, 0xffdda1, [side * 0.91, 1.065, -2.145], [0.21, 0.055, 0.02]);
  }
  box(car, PALETTE.outline, [0, 0.91, 2.115], [0.90, 0.18, 0.055]);
  for (const y of [0.87, 0.95]) box(car, 0xb8d2cb, [0, y, 2.15], [0.74, 0.018, 0.024]);
  box(car, PALETTE.cream, [0, 0.90, -2.128], [0.50, 0.17, 0.027]);
  box(car, PALETTE.outline, [0, 0.90, -2.147], [0.27, 0.035, 0.012]);

  // A roof rack and two strapped cases make the family car unmistakably vacation-ready.
  for (const x of [-0.70, 0.70]) {
    rod(car, PALETTE.outline, [x, 2.24, -1.15], [x, 2.24, 0.55], 0.035);
    for (const z of [-0.95, 0.35]) rod(car, PALETTE.outline, [x, 2.16, z], [x, 2.24, z], 0.033);
  }
  for (const z of [-0.9, 0.25]) rod(car, PALETTE.outline, [-0.81, 2.25, z], [0.81, 2.25, z], 0.035);
  box(car, 0x65afa8, [-0.42, 2.43, -0.39], [0.72, 0.36, 1.18]);
  box(car, PALETTE.yellow, [0.40, 2.40, -0.39], [0.70, 0.30, 0.98]);
  for (const x of [-0.42, 0.40]) {
    const top = x < 0 ? 2.615 : 2.555;
    box(car, PALETTE.cream, [x, top, -0.39], [0.07, 0.018, x < 0 ? 1.12 : 0.92]);
    box(car, PALETTE.outline, [x, top + 0.018, -0.39], [0.23, 0.038, 0.07]);
  }

  return car;
}
