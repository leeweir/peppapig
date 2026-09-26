import * as THREE from 'three';

const HOURS_PER_SECOND = 24 / 480;
const smooth = THREE.MathUtils.smoothstep;

export function createDayNight({ scene, camera, skyLight, sun, world, initialTime, reducedMotion = false }) {
  let time = Number.isFinite(initialTime) && initialTime >= 0 && initialTime < 24 ? initialTime : 9;
  let mode = 'auto';
  let initialized = false;
  let nightAmount = 0;
  let twilightAmount = 0;

  const daySky = scene.background.clone();
  const dayFog = scene.fog?.color.clone();
  const dayAmbient = skyLight.color.clone();
  const dayGround = skyLight.groundColor.clone();
  const daySun = sun.color.clone();
  const dayAmbientIntensity = skyLight.intensity;
  const daySunIntensity = sun.intensity;
  const nightSky = new THREE.Color(0x142a50);
  const nightAmbient = new THREE.Color(0xc4d9ff);
  const nightGround = new THREE.Color(0x7188b0);
  const nightSun = new THREE.Color(0xb9ceff);
  const twilightSky = new THREE.Color(0xefb5a1);
  const twilightAmbient = new THREE.Color(0xffdfd2);
  const twilightGround = new THREE.Color(0xa4a18b);
  const twilightSun = new THREE.Color(0xffcc98);

  // A distant, depth-tested storybook sky: terrain and roofs still obscure it.
  // Its screen-relative layout keeps a few stars near the top of the downward view.
  const sky = new THREE.Group();
  sky.name = 'Moon and stars';
  sky.visible = false;
  scene.add(sky);

  const starCount = 96;
  const starPositions = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    const column = i % 12;
    const row = Math.floor(i / 12);
    const jitterX = Math.sin(i * 23.17 + 4) * .28;
    const jitterY = Math.sin(i * 17.31 + 2) * .25;
    starPositions[i * 3] = -1 + (column + .5 + jitterX) / 6;
    starPositions[i * 3 + 1] = .18 + (row + .5 + jitterY) * .1;
    starSizes[i] = 2.4 + (i * 13 % 11) * .25;
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeometry.setAttribute('starSize', new THREE.BufferAttribute(starSizes, 1));
  const starMaterial = new THREE.ShaderMaterial({
    uniforms: { opacity: { value: 0 }, color: { value: new THREE.Color(0xf1f0d9) } },
    vertexShader: `
      attribute float starSize;
      varying float brightness;
      void main() {
        brightness = .6 + starSize * .08;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = starSize;
      }
    `,
    fragmentShader: `
      uniform float opacity;
      uniform vec3 color;
      varying float brightness;
      void main() {
        float radius = length(gl_PointCoord - vec2(.5));
        if (radius >= .5) discard;
        float edge = 1.0 - smoothstep(.28, .5, radius);
        gl_FragColor = vec4(color, edge * opacity * brightness);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  const stars = new THREE.Points(starGeometry, starMaterial);
  stars.frustumCulled = false;
  sky.add(stars);

  const moonMaterial = new THREE.ShaderMaterial({
    uniforms: {
      opacity: { value: 0 },
      color: { value: new THREE.Color(0xffebbd) },
      craterColor: { value: new THREE.Color(0xcbbfa2) },
    },
    vertexShader: `
      varying vec2 moonUv;
      void main() {
        moonUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float opacity;
      uniform vec3 color;
      uniform vec3 craterColor;
      varying vec2 moonUv;
      void main() {
        float craters = 1.0 - smoothstep(.075, .12, distance(moonUv, vec2(.34, .65)));
        craters += 1.0 - smoothstep(.045, .075, distance(moonUv, vec2(.65, .38)));
        craters += 1.0 - smoothstep(.03, .055, distance(moonUv, vec2(.43, .29)));
        float edge = 1.0 - smoothstep(.485, .5, distance(moonUv, vec2(.5)));
        gl_FragColor = vec4(mix(color, craterColor, craters * .28), opacity * edge);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  const moon = new THREE.Mesh(new THREE.CircleGeometry(1, 48), moonMaterial);
  moon.frustumCulled = false;
  sky.add(moon);

  function setMode(nextMode) {
    if (nextMode !== 'auto' && nextMode !== 'day' && nextMode !== 'night') return;
    mode = nextMode;
    if (mode === 'day') time = 9;
    else if (mode === 'night') time = 21;
  }

  function startNight() {
    time = 21;
    mode = 'auto';
  }

  function update(dt, inside) {
    const elapsed = Number.isFinite(dt) && dt > 0 ? dt : 0;
    if (mode === 'auto') time = (time + (elapsed % 480) * HOURS_PER_SECOND) % 24;
    const targetNight = time < 12 ? 1 - smooth(time, 5, 8) : smooth(time, 17, 20);
    const targetTwilight = Math.sin(targetNight * Math.PI);
    // Snap only the first frame (including restored fixed modes), never flash day.
    const blend = !initialized || reducedMotion ? 1 : 1 - Math.exp(-elapsed * 2.2);
    nightAmount += (targetNight - nightAmount) * blend;
    twilightAmount += (targetTwilight - twilightAmount) * blend;
    if (Math.abs(targetNight - nightAmount) < .00001) nightAmount = targetNight;
    if (Math.abs(targetTwilight - twilightAmount) < .00001) twilightAmount = targetTwilight;
    initialized = true;

    scene.background.copy(daySky).lerp(nightSky, nightAmount).lerp(twilightSky, twilightAmount);
    if (scene.fog) scene.fog.color.copy(dayFog).lerp(nightSky, nightAmount).lerp(twilightSky, twilightAmount);
    skyLight.color.copy(dayAmbient).lerp(nightAmbient, nightAmount).lerp(twilightAmbient, twilightAmount);
    skyLight.groundColor.copy(dayGround).lerp(nightGround, nightAmount).lerp(twilightGround, twilightAmount);
    skyLight.intensity = THREE.MathUtils.lerp(THREE.MathUtils.lerp(dayAmbientIntensity, 1.55, nightAmount), 2, twilightAmount);
    sun.color.copy(daySun).lerp(nightSun, nightAmount).lerp(twilightSun, twilightAmount);
    sun.intensity = THREE.MathUtils.lerp(THREE.MathUtils.lerp(daySunIntensity, .75, nightAmount), 1.8, twilightAmount);
    world.setNight(nightAmount);

    const visibility = smooth(nightAmount, .25, .95) * (1 - twilightAmount * .6);
    sky.visible = !inside && visibility > .001;
    if (!sky.visible) return;
    starMaterial.uniforms.opacity.value = visibility * .9;
    moonMaterial.uniforms.opacity.value = visibility;
    camera.getWorldPosition(sky.position);
    camera.getWorldQuaternion(sky.quaternion);
    // Projection scales also cover portrait screens, resized aspect ratios and zoom.
    // Camera-space depth, not radial distance, determines the far-plane clipping.
    const distance = Math.min(210, camera.far * .9);
    const halfWidth = distance / camera.projectionMatrix.elements[0];
    const halfHeight = distance / camera.projectionMatrix.elements[5];
    stars.position.z = -distance;
    stars.scale.set(halfWidth, halfHeight, 1);
    moon.position.set(halfWidth * .62, halfHeight * .88, -distance + .5);
    moon.scale.setScalar(Math.min(halfHeight * .085, halfWidth * .13));
  }

  return {
    get time() { return time; },
    get period() {
      if (time >= 5 && time < 8) return 'dawn';
      if (time >= 8 && time < 17) return 'day';
      if (time >= 17 && time < 20) return 'dusk';
      return 'night';
    },
    get mode() { return mode; },
    setMode, startNight, update,
  };
}
