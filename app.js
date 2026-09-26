import * as THREE from 'three';
import { createPig } from './models3d.js';
import { createWorld } from './world3d.js';
import { QUESTS, createQuestState, getCurrentQuest, getQuestProgress, recordEvent } from './quests.js';
import { createInput } from './input.js';
import { createNavigator } from './navigation.js';

const $ = selector => document.querySelector(selector);
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const STORAGE_KEY = 'peppa-3d-holiday-v1';
const safe = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function boot() {
  const canvas = $('#world-canvas');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch {
    $('#loading-message').textContent = '这个浏览器暂时无法开启 3D。请开启硬件加速，或用新版 Chrome、Edge、Safari 再试一次。';
    const retry = document.createElement('button');
    retry.className = 'primary-button';
    retry.textContent = '重新尝试';
    retry.onclick = () => location.reload();
    $('#loading').append(retry);
    return;
  }
  const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 700;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.35 : 1.75));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .92;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa9dfef);
  scene.fog = new THREE.Fog(0xa9dfef, 72, 160);
  const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, .1, 240);
  const skyLight = new THREE.HemisphereLight(0xe9f9ff, 0x91ad66, 2.5);
  scene.add(skyLight);
  const sun = new THREE.DirectionalLight(0xfff3d4, 2.8);
  sun.position.set(-25, 48, 32);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -52;
  sun.shadow.camera.right = sun.shadow.camera.top = 52;
  sun.shadow.camera.near = .5;
  sun.shadow.camera.far = 120;
  sun.shadow.bias = -.0003;
  sun.shadow.normalBias = .025;
  scene.add(sun, sun.target);

  const world = createWorld();
  scene.add(world.group);
  const registry = new Map(world.interactables.map(object => [object.id, object]));
  const navigator = createNavigator(world.colliders, world.bounds);
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { /* Start a fresh in-memory holiday when storage is unavailable. */ }
  if (saved?.version !== 1) saved = null;
  const quest = createQuestState(saved?.quest);
  const actions = new Set(Array.isArray(saved?.actions) ? saved.actions.filter(id => registry.has(id)) : []);
  let photos = Array.isArray(saved?.photos) ? saved.photos.filter(photo => typeof photo.id === 'string' && typeof photo.data === 'string' && photo.data.startsWith('data:image/jpeg;base64,')).slice(-8) : [];
  let soundEnabled = saved?.sound === true;
  let zone = saved?.zone === 'inside' ? 'inside' : 'outside';
  const actor = new THREE.Group();
  let avatar = createPig({ boots: actions.has('boots') });
  actor.add(avatar);
  scene.add(actor);
  const spawn = zone === 'inside' ? world.interiorSpawn : world.spawn;
  const position = saved?.position;
  if (position && Number.isFinite(position.x) && Number.isFinite(position.z) && navigator.canStand(position.x, position.z, zone)) actor.position.set(position.x, world.terrainHeight(position.x, position.z), position.z);
  else actor.position.set(spawn.x, world.terrainHeight(spawn.x, spawn.z), spawn.z);
  actor.rotation.y = Math.PI;
  world.setZone(zone);
  const car = registry.get('car');
  if (saved?.car && Number.isFinite(saved.car.x) && Number.isFinite(saved.car.z) && navigator.canStand(saved.car.x, saved.car.z, 'outside')) {
    car.position.set(saved.car.x, world.terrainHeight(saved.car.x, saved.car.z), saved.car.z);
    car.mesh.position.copy(car.position);
  }
  let driving = false;
  let kiteFlying = false;
  let activity = null;
  let cameraMode = null;
  let jumpHeight = 0;
  let jumpVelocity = 0;
  let nearest = null;
  let target = null;
  let route = null;
  let routeIndex = 0;
  let stuckTime = 0;
  let walkTime = 0;
  let kiteDistance = 0;
  let simTime = 0;
  let uiTime = 0;
  let saveTime = 0;
  let lastSaved = 0;
  let toastRemaining = 0;
  let finaleTime = 0;
  let night = quest.counts['finale:fireworks'] ? 1 : quest.questIndex >= 13 ? .25 : 0;
  let dialogCallback = null;
  let previousFocus = null;
  let audio = null;
  let cameraYaw = zone === 'inside' ? .12 : .38;
  let cameraPitch = zone === 'inside' ? .78 : .48;
  let cameraDistance = zone === 'inside' ? 20 : mobile ? 24 : 25;
  const lookAt = new THREE.Vector3();
  const cameraDesired = new THREE.Vector3();
  const cameraLook = new THREE.Vector3();
  const temp = new THREE.Vector3();
  const movement = { x: 0, y: 0, running: false };
  const dialog = $('#game-dialog');
  const dialogContent = $('#dialog-content');
  const minimap = $('#minimap');
  const mapContext = minimap.getContext('2d');
  const hud = $('#hud');
  const skyDay = new THREE.Color(0xa9dfef);
  const skyNight = new THREE.Color(0x334577);

  const marker = new THREE.Group();
  const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xffda69, depthTest: false });
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(.4), markerMaterial);
  diamond.renderOrder = 8;
  const markerRing = new THREE.Mesh(new THREE.TorusGeometry(.8, .045, 6, 32), markerMaterial);
  markerRing.rotation.x = -Math.PI / 2;
  markerRing.renderOrder = 7;
  marker.add(diamond, markerRing);
  scene.add(marker);
  const routeGeometry = new THREE.BufferGeometry();
  const routeLine = new THREE.Line(routeGeometry, new THREE.LineDashedMaterial({ color: 0xffe59a, dashSize: .28, gapSize: .28, transparent: true, opacity: .85, depthWrite: false }));
  scene.add(routeLine);

  const particleCapacity = 120;
  const particles = new THREE.InstancedMesh(new THREE.SphereGeometry(.09, 6, 4), new THREE.MeshBasicMaterial(), particleCapacity);
  particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  particles.frustumCulled = false;
  scene.add(particles);
  const particleState = Array.from({ length: particleCapacity }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, gravity: 8 }));
  const particleTransform = new THREE.Object3D();
  const particleColor = new THREE.Color();
  let particleCursor = 0;
  for (let i = 0; i < particleCapacity; i++) { particleTransform.scale.setScalar(0); particleTransform.updateMatrix(); particles.setMatrixAt(i, particleTransform.matrix); }

  const kite = new THREE.Group();
  const kiteShape = new THREE.Shape();
  kiteShape.moveTo(0, 1.5); kiteShape.lineTo(.9, 0); kiteShape.lineTo(0, -1.2); kiteShape.lineTo(-.9, 0); kiteShape.closePath();
  const kiteMesh = new THREE.Mesh(new THREE.ShapeGeometry(kiteShape), new THREE.MeshStandardMaterial({ color: 0xee789f, side: THREE.DoubleSide, roughness: .9 }));
  kite.add(kiteMesh);
  const kiteCross = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1.5, .01), new THREE.Vector3(0, -1.2, .01), new THREE.Vector3(-.9, 0, .01), new THREE.Vector3(.9, 0, .01)]), new THREE.LineBasicMaterial({ color: 0xffedaa }));
  kite.add(kiteCross);
  for (let i = 0; i < 5; i++) {
    const bow = new THREE.Mesh(new THREE.PlaneGeometry(.35, .2), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x90cce7 : 0xf9d87a, side: THREE.DoubleSide }));
    bow.position.set(Math.sin(i) * .16, -1.45 - i * .34, 0); bow.rotation.z = i % 2 ? .4 : -.4; kite.add(bow);
  }
  kite.visible = false;
  scene.add(kite);
  const kiteStringPositions = new Float32Array(6);
  const kiteStringGeometry = new THREE.BufferGeometry();
  kiteStringGeometry.setAttribute('position', new THREE.BufferAttribute(kiteStringPositions, 3));
  const kiteString = new THREE.Line(kiteStringGeometry, new THREE.LineBasicMaterial({ color: 0xf5f1d9 }));
  kiteString.frustumCulled = false;
  kiteString.visible = false;
  scene.add(kiteString);

  const wateringCan = new THREE.Group();
  const canMaterial = new THREE.MeshStandardMaterial({ color: 0x74bdcf, roughness: .8 });
  const canBody = new THREE.Mesh(new THREE.CylinderGeometry(.22, .2, .35, 12), canMaterial);
  const canSpout = new THREE.Mesh(new THREE.CylinderGeometry(.07, .045, .4, 8), canMaterial);
  canSpout.rotation.z = -.8; canSpout.position.set(.28, .03, 0);
  wateringCan.add(canBody, canSpout); wateringCan.visible = false; scene.add(wateringCan);

  function sound(kind = 'tap') {
    if (!soundEnabled) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      audio ||= new Audio();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      const frequencies = kind === 'complete' ? [523, 659, 784, 1047] : kind === 'splash' ? [190, 120, 80] : kind === 'collect' ? [740, 988] : [560];
      frequencies.forEach((frequency, index) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        const time = audio.currentTime + index * .1;
        oscillator.type = kind === 'splash' ? 'triangle' : 'sine';
        oscillator.frequency.setValueAtTime(frequency, time);
        gain.gain.setValueAtTime(.001, time);
        gain.gain.linearRampToValueAtTime(.055, time + .015);
        gain.gain.exponentialRampToValueAtTime(.001, time + .23);
        oscillator.connect(gain); gain.connect(audio.destination);
        oscillator.start(time); oscillator.stop(time + .25);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      });
    } catch { /* Visible feedback remains available without audio. */ }
  }

  function save() {
    const data = { version: 1, quest, actions: [...actions], photos, zone, position: { x: actor.position.x, z: actor.position.z }, car: { x: car.position.x, z: car.position.z }, sound: soundEnabled };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      $('#save-status').textContent = '冒险进度已自动保存';
    } catch {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, photos: [] }));
        $('#save-status').textContent = '进度已保存，照片请下载留念';
      } catch { $('#save-status').textContent = '本次进度暂存内存，关闭后不会保留'; }
    }
    lastSaved = simTime;
  }

  function toast(title, message = '', duration = 4) {
    $('#toast-title').textContent = title;
    $('#toast-message').textContent = message;
    $('#toast').hidden = false;
    toastRemaining = duration;
    $('#announcer').textContent = `${title} ${message}`;
  }

  function emit(key, amount = 1) {
    const result = recordEvent(quest, key, amount);
    if (!result.changed) return;
    if (result.completed.length) {
      const finished = QUESTS.find(item => item.id === result.completed[result.completed.length - 1]);
      toast(`完成：${finished.title}`, result.allCompleted ? '十四个快乐回忆，装满了我们的完美假期。' : `下一段冒险：${getCurrentQuest(quest).title}`, 5);
      sound('complete');
      burst(actor.position, 0xffdc73, 24, 4);
      if (quest.questIndex !== 7) kiteFlying = false;
      save();
    } else if (simTime - lastSaved > 1) save();
    updateQuestUI();
  }

  function applyWorldState() {
    for (const object of world.interactables) {
      if (['pickup', 'collect'].includes(object.type)) object.mesh.visible = !actions.has(object.id);
      if (object.type === 'water' && actions.has(object.id)) object.mesh.userData.bloom?.scale.setScalar(1.5);
      if (object.type === 'lantern' && actions.has(object.id)) {
        if (object.mesh.userData.light) object.mesh.userData.light.intensity = 3;
        object.mesh.traverse(child => { if (child.isMesh && child.material?.emissive) { child.material = child.material.clone(); child.material.emissive.set(0xffb557); child.material.emissiveIntensity = .18; } });
      }
    }
    const parts = registry.get('sandcastle').mesh.userData.castleParts || [];
    parts.forEach((part, index) => { part.visible = index < (quest.counts['build:sandcastle'] || 0); if (part.visible) part.scale.setScalar(1); });
    const food = registry.get('picnic').mesh.userData.food;
    if (food) food.visible = Boolean(quest.counts['picnic:serve']);
  }
  applyWorldState();

  function getObjective() { return getQuestProgress(quest).objectives.find(objective => !objective.done) || null; }
  function resolveTarget() {
    const objective = getObjective();
    if (!objective) return null;
    let ids = objective.targets;
    if (objective.key === 'drive:beach') ids = [driving ? 'beach-arrival' : 'car'];
    const available = ids.map(id => registry.get(id)).filter(Boolean).filter(object => !actions.has(object.id) || !['pickup', 'collect', 'water', 'lantern'].includes(object.type));
    let selected = available.reduce((closest, object) => !closest || actor.position.distanceToSquared(object.position) < actor.position.distanceToSquared(closest.position) ? object : closest, null);
    if (!selected) selected = registry.get(ids[0]);
    if (selected && selected.zone !== zone) return registry.get(zone === 'inside' ? 'home-exit' : 'home-door');
    return selected;
  }

  function updateQuestUI() {
    const current = getCurrentQuest(quest);
    const progress = getQuestProgress(quest);
    $('#quest-count').textContent = quest.completed.length;
    $('.quest-eyebrow > span').innerHTML = `<i></i>${current ? `主线冒险 ${String(quest.questIndex + 1).padStart(2, '0')} / 14` : '自由探索时光'}`;
    $('#quest-title').textContent = current?.title || '我们的完美假期';
    $('#quest-description').textContent = current?.description || '所有主线都完成啦！开车兜风、玩秋千、跳泥坑，或者再拍一张快乐合影。';
    $('#quest-objectives').innerHTML = progress.objectives.map(objective => `<li class="${objective.done ? 'done' : ''}"><span class="objective-check">${icon('check')}</span><span class="objective-text">${safe(objective.label)}</span><span class="objective-count">${Math.min(objective.total, Math.floor(objective.current))} / ${objective.total}</span></li>`).join('');
    target = resolveTarget();
    $('#guide-button').innerHTML = `${current ? '带我过去' : '自由探索'}${icon('arrow')}`;
    $('#guide-button').disabled = !current;
    $('#journal-button').setAttribute('aria-label', `任务手册，已完成${quest.completed.length}个，共14个任务`);
  }

  function stopRoute() {
    route = null; routeIndex = 0; stuckTime = 0;
    routeLine.visible = false;
    $('#navigation-banner').hidden = true;
  }
  function showRoute(points, label) {
    route = points;
    routeIndex = 0;
    stuckTime = 0;
    $('#navigation-banner').hidden = false;
    $('#navigation-message').textContent = label;
    const positions = points.map(point => new THREE.Vector3(point.x, world.terrainHeight(point.x, point.z) + .09, point.z));
    routeGeometry.setFromPoints(positions);
    routeLine.computeLineDistances();
    routeLine.visible = true;
  }
  function guideTo(object) {
    if (activity || cameraMode) return;
    if (!object) return;
    if (object.zone && object.zone !== zone) object = registry.get(zone === 'inside' ? 'home-exit' : 'home-door');
    const destination = object.position || object;
    const range = Math.max(.9, (object.radius || 2) - .55);
    const points = navigator.pathTo(actor.position, destination, zone, range);
    if (points === null) { toast('这边的小路有点绕', '试试用方向键绕过前面的物品，再按「带我过去」。'); return; }
    if (!points.length) { toast('已经到啦', object.type === 'puddle' ? '在泥坑里按空格跳起来！' : '按 E 或点「互动」，继续这段冒险。', 2.5); return; }
    showRoute(points, `前往${object.label || object.name || '地图上的小站'}，移动可停止`);
    canvas.focus({ preventScroll: true });
  }
  function guideCurrent() {
    const objective = getObjective();
    if (objective?.key === 'fly:kite' && kiteFlying && zone === 'outside') {
      const points = [];
      let start = actor.position;
      for (const destination of [{ x: 24, z: -10 }, { x: 29, z: -2 }, { x: 19, z: 1 }, { x: 17, z: -12 }, { x: 26, z: -10 }]) {
        const segment = navigator.pathTo(start, destination, zone, 1);
        if (segment?.length) { points.push(...segment); start = segment[segment.length - 1]; }
      }
      if (points.length) showRoute(points, '迎着风跑起来，让风筝飞得高高的');
      return;
    }
    target = resolveTarget();
    guideTo(target);
  }

  function openDialog(title, html) {
    stopRoute();
    input.reset();
    previousFocus = document.activeElement;
    $('#dialog-title').textContent = title;
    dialogContent.innerHTML = html;
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
  }
  function closeDialog() {
    dialogCallback = null;
    if (dialog.open) dialog.close();
  }
  dialog.addEventListener('close', () => { input.reset(); dialogCallback = null; if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }); });
  $('#dialog-close').addEventListener('click', closeDialog);
  dialog.addEventListener('click', event => {
    if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeDialog(); }
  });
  dialog.addEventListener('keydown', event => { if (event.code === 'KeyE' && dialogCallback && !event.repeat) { event.preventDefault(); dialogCallback(); } });

  function talk(name, lines, onFinish) {
    let line = 0;
    openDialog('和家人聊聊天', `<div class="speech-person"><span class="person-avatar">${name.slice(0, 1)}</span><div><h2>${safe(name)}</h2><small>每一段冒险，都从一句话开始</small></div></div><p class="speech-text" id="speech-text"></p><div class="dialog-buttons"><button class="primary-button" id="speech-next"></button><span class="speech-step" id="speech-step"></span></div>`);
    const draw = () => { $('#speech-text').textContent = lines[line]; $('#speech-step').textContent = `${line + 1} / ${lines.length}`; $('#speech-next').textContent = line === lines.length - 1 ? '好呀，出发！' : '接着听'; };
    const advance = () => {
      if (line < lines.length - 1) { line++; draw(); return; }
      closeDialog();
      onFinish?.();
    };
    dialogCallback = advance;
    $('#speech-next').addEventListener('click', advance);
    draw();
    $('#speech-next').focus();
    sound();
  }

  function openJournal() {
    openDialog('我的假期手册', `<h2>十四站，满满的快乐</h2><div class="journal-summary">${icon('star')}已经完成 ${quest.completed.length} / 14 个主线任务</div><div class="quest-list">${QUESTS.map((item, index) => `<section class="journal-quest ${index < quest.questIndex ? 'completed' : index === quest.questIndex ? 'active' : ''}"><span class="quest-number">${index < quest.questIndex ? '✓' : String(index + 1).padStart(2, '0')}</span><div><h3>${safe(item.title)}${index === quest.questIndex ? ' · 正在冒险' : ''}</h3><p>${safe(item.description)}</p></div></section>`).join('')}</div>`);
  }
  function openMap() {
    openDialog('假期世界地图', `<h2>想去哪里玩？</h2><canvas id="large-map" class="map-large" width="600" height="600" aria-label="假期地图，粉色标记是你现在的位置"></canvas><div class="map-places">${world.locations.map(place => `<button data-location="${safe(place.id)}">${safe(place.name)}</button>`).join('')}</div><p class="map-note">选一个地点，佩奇会沿着小路走过去。也可以随时自己移动，继续探索。</p>`);
    drawMap($('#large-map').getContext('2d'), 600, true);
    dialogContent.querySelectorAll('[data-location]').forEach(button => button.onclick = () => {
      const place = world.locations.find(item => item.id === button.dataset.location);
      closeDialog(); guideTo({ ...place, zone: 'outside', radius: 4 });
    });
  }
  function openAlbum() {
    openDialog('我的假期相册', `<h2>把快乐留下来</h2>${photos.length ? `<div class="album-grid">${photos.map(photo => `<article class="photo-card"><img src="${photo.data}" alt="${safe(photo.title)}"/><strong>${safe(photo.title)}</strong><a href="${photo.data}" download="佩奇的假期-${safe(photo.id)}.jpg">下载这张回忆</a></article>`).join('')}</div>` : `<div class="empty-album">${icon('camera')}<p>先到家里拿上照相机，<br>再去海边或营地的相机标记拍照吧。</p></div>`}<div class="dialog-buttons"><button class="primary-button" id="free-photo">拍一张新照片</button><button class="secondary-button" id="album-return">继续探索</button></div><p class="pause-note">相册最多保留最近 8 张，喜欢的照片可以下载留念。</p>`);
    $('#free-photo').onclick = () => { closeDialog(); enterCamera(null); };
    $('#album-return').onclick = closeDialog;
  }
  function openPause() {
    openDialog('慢慢玩，不赶时间', `<h2>假期休息一下</h2><p>移动和活动已经暂停，回来的时候接着玩。</p><div class="controls-table"><div><kbd>WASD</kbd>移动 / 方向键</div><div><kbd>空格</kbd>跳跃 / 推秋千</div><div><kbd>E</kbd>和身边的人或物互动</div><div><kbd>Shift</kbd>跑得快一点</div><div><kbd>拖动</kbd>转动视角</div><div><kbd>滚轮</kbd>拉近或拉远</div><div><kbd>J / M</kbd>任务手册 / 地图</div><div><kbd>P / K</kbd>相册 / 收放风筝</div></div><p class="pause-note">手机：左手摇杆移动，右手拖动画面看四周；右下按钮跳跃和互动。任务卡里的「带我过去」会带你沿小路行走。</p><div class="dialog-buttons"><button class="primary-button" id="resume-game">继续冒险</button><button class="secondary-button" id="return-home">回到家门口</button><button class="secondary-button" id="pause-album">假期相册</button></div><div class="reset-area"><button class="text-button" id="reset-game">重新开始这次假期</button><div class="reset-warning" id="reset-warning" hidden><p>会清空这台设备上的主线进度和照片。确定重新出发吗？</p><button class="secondary-button" id="cancel-reset">保留回忆</button> <button class="primary-button" id="confirm-reset">清空并重新开始</button></div></div><p class="pause-note">非官方创意游戏。场景与冒险为原创制作，不代表电影正式剧情。</p>`);
    $('#resume-game').onclick = closeDialog;
    $('#return-home').onclick = () => { closeDialog(); if (driving) exitCar(); changeZone('outside', world.spawn); toast('欢迎回家', '小黄屋一直在这里等你。'); };
    $('#pause-album').onclick = openAlbum;
    $('#reset-game').onclick = () => { $('#reset-warning').hidden = false; $('#cancel-reset').focus(); };
    $('#cancel-reset').onclick = () => { $('#reset-warning').hidden = true; $('#reset-game').focus(); };
    $('#confirm-reset').onclick = () => { try { localStorage.removeItem(STORAGE_KEY); } catch { /* Reload still starts fresh if storage is blocked. */ } location.reload(); };
  }

  function changeZone(nextZone, destination) {
    stopRoute();
    endActivity(false);
    kiteFlying = false;
    zone = nextZone;
    world.setZone(zone);
    actor.position.set(destination.x, world.terrainHeight(destination.x, destination.z), destination.z);
    jumpHeight = jumpVelocity = 0;
    cameraDistance = zone === 'inside' ? 20 : mobile ? 24 : 25;
    cameraPitch = zone === 'inside' ? .78 : .48;
    cameraYaw = zone === 'inside' ? .12 : .38;
    updateCamera(1, true);
    updateQuestUI();
    save();
  }

  function collect(object) {
    if (actions.has(object.id)) return;
    const event = object.id.startsWith('carrot-') ? 'collect:carrot' : object.id.startsWith('shell-') ? 'collect:shell' : object.id.startsWith('sand-') ? 'collect:sand' : `collect:${object.id}`;
    actions.add(object.id);
    object.mesh.visible = false;
    if (object.id === 'boots') {
      actor.remove(avatar);
      avatar = createPig({ boots: true });
      actor.add(avatar);
    }
    burst(object.position, 0xffdf83, 14, 3);
    sound('collect');
    toast(`找到${object.label}啦`, object.id === 'dinosaur' ? '快把它带回去给乔治看看！' : '已经收进你的假期小背包。', 2.5);
    emit(event);
    save();
  }

  function startActivity(type, object) {
    stopRoute();
    jumpHeight = jumpVelocity = 0;
    activity = { type, object, time: 0, hits: 0, lastCycle: -1, pulse: 0, endAt: 0, start: actor.position.clone() };
    if (type === 'slide') {
      const points = object.mesh.userData.slidePath;
      activity.path = new THREE.CatmullRomCurve3(points);
    }
    if (type === 'seesaw') {
      const partner = object.mesh.userData.partner ||= createPig({ dress: 0xb593ce, scale: .8, boots: false });
      partner.position.set(2.55, .22, 0);
      partner.rotation.y = -Math.PI / 2;
      object.mesh.userData.beam.add(partner);
      activity.partner = partner;
    }
    if (type === 'ducks') activity.duckStarts = object.mesh.children.map(duck => duck.position.clone());
    const titles = { water: '给小花喝点水', swing: '荡呀，荡秋千', slide: '爬上去，滑下来！', seesaw: '一上一下，跷跷板', ducks: '给小鸭子开饭啦' };
    $('#activity-title').textContent = titles[type];
    $('#activity-instruction').textContent = type === 'swing' ? '等到「现在推！」，按空格或点跳跃。推三次吧！' : type === 'seesaw' ? '按空格或点跳跃，和另一头的小猪一起上下摇摆。' : type === 'slide' ? '佩奇正在爬上梯子，准备滑下去。' : type === 'water' ? '轻轻浇水，花朵很快就会绽放。' : '面包屑撒到水面上，小鸭子游过来啦。';
    $('#activity-fill').style.width = '0%';
    $('#activity-bar').hidden = false;
    $('#interaction-prompt').hidden = true;
    sound();
  }
  function endActivity(completed = false) {
    if (!activity) return;
    const previous = activity;
    activity = null;
    $('#activity-bar').hidden = true;
    wateringCan.visible = false;
    if (previous.partner) previous.partner.removeFromParent();
    actor.rotation.x = actor.rotation.z = 0;
    if (previous.object.mesh.userData.seat) previous.object.mesh.userData.seat.rotation.x = 0;
    if (previous.object.mesh.userData.beam) previous.object.mesh.userData.beam.rotation.z = 0;
    if (!navigator.canStand(actor.position.x, actor.position.z, zone)) actor.position.copy(previous.start);
    actor.position.y = world.terrainHeight(actor.position.x, actor.position.z);
    jumpHeight = jumpVelocity = 0;
    if (completed && previous.type === 'swing') emit('ride:swing');
    if (completed && previous.type === 'slide') emit('ride:slide');
    save();
  }

  function enterCar() {
    if (!quest.counts['talk:dad']) { talk('猪爸爸', ['开车去海边之前，先来跟我聊一聊吧。我就在家门口等你。']); return; }
    stopRoute();
    driving = true;
    avatar.visible = false;
    actor.position.copy(car.position);
    jumpHeight = jumpVelocity = 0;
    cameraDistance = 21;
    $('#mode-label').textContent = '红色小汽车 · E 下车';
    $('#mode-label').hidden = false;
    toast('系好安全带，出发！', 'WASD 或摇杆开车，E 下车。「带我过去」也可以沿路开往海滩。');
    updateQuestUI();
  }
  function exitCar() {
    if (!driving) return;
    let found = null;
    for (const [dx, dz] of [[2.4,0],[-2.4,0],[0,3],[0,-3]]) {
      if (navigator.canStand(actor.position.x + dx, actor.position.z + dz, zone)) { found = { x: actor.position.x + dx, z: actor.position.z + dz }; break; }
    }
    driving = false;
    avatar.visible = true;
    if (found) { actor.position.x = found.x; actor.position.z = found.z; }
    actor.position.y = world.terrainHeight(actor.position.x, actor.position.z);
    cameraDistance = mobile ? 24 : 25;
    $('#mode-label').hidden = true;
    stopRoute(); updateQuestUI(); save();
  }

  function enterCamera(object) {
    if (!actions.has('camera')) { toast('还缺一台照相机', '先到家里的卧室拿上照相机吧。'); return; }
    if (driving) { toast('先下车再拍照', '按 E 停车，选一个喜欢的角度。'); return; }
    stopRoute();
    cameraMode = { object };
    hud.hidden = true;
    marker.visible = false;
    $('#camera-frame').hidden = false;
    canvas.focus({ preventScroll: true });
  }
  function exitCamera() {
    cameraMode = null;
    hud.hidden = false;
    $('#camera-frame').hidden = true;
  }
  function takePhoto() {
    if (!cameraMode) return;
    const object = cameraMode.object;
    if (object && actor.position.distanceTo(object.position) > object.radius + 2) { toast('离拍照点有点远啦', '回到相机标记旁边再拍吧。'); exitCamera(); return; }
    marker.visible = false; routeLine.visible = false;
    renderer.render(scene, camera);
    const picture = document.createElement('canvas');
    picture.width = 640; picture.height = 400;
    const context = picture.getContext('2d');
    const sourceWidth = canvas.width;
    const sourceHeight = canvas.height;
    const cropHeight = Math.min(sourceHeight, sourceWidth / 1.6);
    const cropWidth = cropHeight * 1.6;
    context.drawImage(canvas, (sourceWidth - cropWidth) / 2, (sourceHeight - cropHeight) / 2, cropWidth, cropHeight, 0, 0, 640, 400);
    const id = object?.id || `memory-${Date.now()}`;
    const title = object?.id === 'photo-beach' ? '海风里的完美假期' : object?.id === 'photo-camp' ? '小小营地，大大快乐' : '我的假期小发现';
    photos = [...photos.filter(photo => photo.id !== id), { id, title, data: picture.toDataURL('image/jpeg', .78) }].slice(-8);
    exitCamera();
    if (object) emit(object.id === 'photo-beach' ? 'photo:beach' : 'photo:camp');
    sound('collect');
    if (!reducedMotion) { canvas.classList.remove('fade-flash'); void canvas.offsetWidth; canvas.classList.add('fade-flash'); }
    toast('咔嚓！快乐已经留下', '打开右上角的假期相册，还可以把照片下载下来。');
    save();
  }

  function interact() {
    if (dialog.open) return;
    if (cameraMode) { takePhoto(); return; }
    if (activity) return;
    if (driving) { exitCar(); return; }
    updateNearby();
    if (!nearest) { toast('走近一点再试试', '靠近家人、玩具或黄色任务标记，再按 E 互动。', 2); return; }
    const object = nearest;
    stopRoute();
    if (object.type === 'door') { changeZone(zone === 'inside' ? 'outside' : 'inside', zone === 'inside' ? world.exteriorSpawn : world.interiorSpawn); sound(); return; }
    if (object.type === 'npc') {
      if (object.id === 'mom') talk('猪妈妈', ['今天的天气真好！我们的完美假期，从家门口开始。', '先回家拿上雨靴和照相机吧。花园、游乐场和海边，还有好多快乐在等着你。'], () => emit('talk:mom'));
      if (object.id === 'george') {
        if (actions.has('dinosaur')) talk('乔治', ['恐龙！你找到我的小恐龙啦！', '谢谢佩奇。我们一起带着恐龙去冒险吧！'], () => emit('return:dinosaur'));
        else talk('乔治', ['我的小恐龙不见了……', '刚才它还在花园附近。你能帮我找找吗？']);
      }
      if (object.id === 'grandpa') {
        if ((quest.counts['collect:carrot'] || 0) >= 3) talk('猪爷爷', ['这三根胡萝卜长得真棒！谢谢小小园丁。', '把它们带去野餐吧，自己收获的蔬菜最好吃。'], () => emit('talk:grandpa'));
        else talk('猪爷爷', ['你好呀，小园丁！旁边的菜地里有三根成熟的胡萝卜。', '都收好以后，再来给爷爷看看吧。']);
      }
      if (object.id === 'dad') talk('猪爸爸', ['想去海边吗？红色小汽车已经准备好啦。', '靠近汽车按 E 上车，再用方向键或摇杆沿着小路开到海滩。我们慢慢开，安全第一！'], () => emit('talk:dad'));
      return;
    }
    if (['pickup', 'collect'].includes(object.type)) { collect(object); return; }
    if (object.type === 'water') {
      if (actions.has(object.id)) { toast('小花已经喝饱啦', '可以再看看其他的花坛。', 2); return; }
      startActivity('water', object); return;
    }
    if (object.type === 'puddle') { jump(); return; }
    if (['swing', 'slide', 'seesaw', 'ducks'].includes(object.type)) { startActivity(object.type, object); return; }
    if (object.type === 'car') { enterCar(); return; }
    if (object.type === 'kite') {
      kiteFlying = !kiteFlying;
      if (kiteFlying) { emit('collect:kite'); toast('风筝准备好啦', '跑起来，风筝就会跟着你飞！按 K 可以收起。'); }
      else toast('风筝收好啦', '想玩的时候，再来这里或按 K 放飞。', 2);
      return;
    }
    if (object.type === 'build') {
      const built = quest.counts['build:sandcastle'] || 0;
      if (built >= 3) { toast('我们的沙堡真漂亮', '试着转动视角，或者给沙堡拍一张照片。'); return; }
      if ((quest.counts['collect:sand'] || 0) <= built) { toast('还需要一桶沙', '附近有三只小沙桶，找一只带过来吧。'); return; }
      const part = object.mesh.userData.castleParts?.[built];
      if (part) { part.visible = true; part.scale.setScalar(1); }
      burst(object.position, 0xf7d991, 18, 3.5);
      emit('build:sandcastle'); sound('collect');
      toast(built === 2 ? '沙堡建好啦！' : '再垒高一点点', built === 2 ? '城墙、高塔和旗子，都是我们的作品。' : `已经堆好 ${built + 1} / 3 部分，再放一桶沙。`, 2.5);
      save(); return;
    }
    if (object.type === 'photo') { enterCamera(object); return; }
    if (object.type === 'picnic') {
      if ((quest.counts['collect:carrot'] || 0) < 3) { toast('野餐还差一点准备', '去爷爷的菜园收好三根胡萝卜，再来开饭吧。'); return; }
      if (object.mesh.userData.food) object.mesh.userData.food.visible = true;
      gatherFamily(object.position);
      emit('picnic:serve'); burst(object.position, 0xffd76b, 26, 4);
      talk('猪妈妈', ['自己收的胡萝卜，海边捡的小贝壳，还有一整天的故事。', '一家人在一起，每一次小小的野餐，都可以是完美的假期。']);
      save(); return;
    }
    if (object.type === 'lantern') {
      if (actions.has(object.id)) { toast('这盏灯已经亮啦', '暖暖的灯光，把回家的小路照亮了。', 2); return; }
      actions.add(object.id);
      if (object.mesh.userData.light) object.mesh.userData.light.intensity = 3;
      object.mesh.traverse(child => { if (child.isMesh && child.material?.emissive) { child.material = child.material.clone(); child.material.emissive.set(0xffb557); child.material.emissiveIntensity = .2; } });
      emit('light:lantern'); sound('collect'); burst(object.position, 0xffd27a, 12, 2.8); save(); return;
    }
    if (object.type === 'fireworks') {
      if ((quest.counts['light:lantern'] || 0) < 3 || quest.questIndex < 13) { toast('压轴惊喜要留到最后', '先完成白天的冒险，再点亮家门口的三盏小灯。'); return; }
      night = 1;
      gatherFamily(object.position);
      finaleTime = 9;
      emit('finale:fireworks');
      $('#mode-label').textContent = '我们的完美假期'; $('#mode-label').hidden = false;
      sound('complete');
    }
  }

  function gatherFamily(center) {
    for (const [index, id] of ['mom', 'dad', 'george'].entries()) {
      const object = registry.get(id);
      object.mesh.userData.walkTarget = new THREE.Vector3(center.x + (index - 1) * 2.2, world.terrainHeight(center.x, center.z + 3), center.z + 3);
    }
  }

  function jump() {
    if (dialog.open || cameraMode || driving) return;
    if (activity) {
      if (activity.type === 'swing') {
        const phase = activity.time % 2.3;
        const cycle = Math.floor(activity.time / 2.3);
        if (phase >= .55 && phase < 1.8 && activity.lastCycle !== cycle && !activity.endAt) {
          activity.lastCycle = cycle;
          activity.hits++;
          activity.pulse = 1;
          $('#activity-fill').style.width = `${activity.hits / 3 * 100}%`;
          sound('collect');
          if (activity.hits === 3) { activity.endAt = activity.time + 1.1; $('#activity-instruction').textContent = '推得真棒！佩奇飞得高高的。'; }
        } else if (!activity.endAt) $('#activity-instruction').textContent = '再等一下，看到「现在推！」就按空格。';
      } else if (activity.type === 'seesaw') { activity.hits++; activity.pulse = activity.hits % 2 ? 1 : -1; sound(); $('#activity-instruction').textContent = `一上一下，已经摇了 ${activity.hits} 次！`; }
      return;
    }
    if (jumpHeight > .01 || jumpVelocity !== 0) return;
    jumpVelocity = 8.3;
    sound();
  }

  const input = createInput({ canvas, onInteract: interact, onJump: jump, isBlocked: () => dialog.open || document.hidden, onShortcut(code) {
    if (code === 'Escape') { if (cameraMode) exitCamera(); else if (activity) endActivity(); else openPause(); }
    else if (code === 'KeyJ') openJournal();
    else if (code === 'KeyM') openMap();
    else if (code === 'KeyP') openAlbum();
    else if (code === 'KeyK' && quest.counts['collect:kite'] && zone === 'outside') { kiteFlying = !kiteFlying; toast(kiteFlying ? '让风筝再飞一会儿' : '风筝收好啦', '', 2); }
  } });
  $('#guide-button').onclick = guideCurrent;
  $('#stop-navigation').onclick = stopRoute;
  $('#journal-button').onclick = $('#quest-book-button').onclick = openJournal;
  $('#map-button').onclick = openMap;
  $('#album-button').onclick = openAlbum;
  $('#pause-button').onclick = openPause;
  $('#leave-activity').onclick = () => endActivity();
  $('#shutter-button').onclick = takePhoto;
  $('#close-camera').onclick = exitCamera;
  function updateSound() {
    $('#sound-button').setAttribute('aria-pressed', String(soundEnabled));
    $('#sound-button').setAttribute('aria-label', soundEnabled ? '关闭音效' : '开启音效');
    $('#sound-symbol').setAttribute('href', soundEnabled ? '#i-sound' : '#i-muted');
  }
  $('#sound-button').onclick = () => { soundEnabled = !soundEnabled; updateSound(); sound(); save(); };

  function burst(position, color, count = 15, force = 3, gravity = 8) {
    for (let i = 0; i < count; i++) {
      const index = particleCursor++ % particleCapacity;
      const particle = particleState[index];
      const angle = Math.random() * Math.PI * 2;
      const speed = force * (.35 + Math.random() * .65);
      particle.x = position.x; particle.y = position.y + .35; particle.z = position.z;
      particle.vx = Math.cos(angle) * speed; particle.vz = Math.sin(angle) * speed; particle.vy = force * (.8 + Math.random());
      particle.life = gravity < 1 ? 1.8 : .9;
      particle.gravity = gravity;
      particles.setColorAt(index, particleColor.set(color));
    }
    if (particles.instanceColor) particles.instanceColor.needsUpdate = true;
  }
  function updateParticles(dt) {
    for (let i = 0; i < particleCapacity; i++) {
      const particle = particleState[i];
      if (particle.life > 0) {
        particle.life -= dt;
        particle.vy -= particle.gravity * dt;
        particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.z += particle.vz * dt;
        particleTransform.position.set(particle.x, particle.y, particle.z);
        particleTransform.scale.setScalar(Math.max(0, Math.min(1, particle.life * 2)));
      } else particleTransform.scale.setScalar(0);
      particleTransform.updateMatrix();
      particles.setMatrixAt(i, particleTransform.matrix);
    }
    particles.instanceMatrix.needsUpdate = true;
  }

  function updateActivities(dt) {
    const active = activity;
    if (!active) return;
    active.time += dt;
    if (active.type === 'water') {
      actor.rotation.y = Math.atan2(active.object.position.x - actor.position.x, active.object.position.z - actor.position.z);
      wateringCan.visible = true;
      wateringCan.position.copy(actor.position).add(temp.set(.75, 1.3, .3));
      wateringCan.rotation.z = -.6;
      if (Math.floor(active.time * 12) !== Math.floor((active.time - dt) * 12)) burst(active.object.position, 0x81d5e8, 3, 1.8);
      $('#activity-fill').style.width = `${Math.min(100, active.time / 2.2 * 100)}%`;
      if (active.time >= 2.2) {
        actions.add(active.object.id);
        active.object.mesh.userData.bloom?.scale.setScalar(1.5);
        emit('water:flower');
        endActivity(true);
      }
    } else if (active.type === 'swing') {
      const phase = active.time % 2.3;
      if (!active.endAt) $('#activity-title').textContent = phase >= .55 && phase < 1.8 && active.lastCycle !== Math.floor(active.time / 2.3) ? '现在推！按空格' : '准备…等秋千荡回来';
      const angle = Math.sin(active.time * 2.7) * (.2 + active.hits * .16);
      const seat = active.object.mesh.userData.seat;
      seat.rotation.x = angle;
      seat.updateWorldMatrix(true, false);
      temp.copy(active.object.mesh.userData.seatPosition);
      seat.localToWorld(temp);
      actor.position.copy(temp);
      actor.rotation.y = 0;
      actor.rotation.x = angle * .2;
      for (const leg of avatar.userData.legs) leg.rotation.x = -.9;
      if (active.endAt && active.time >= active.endAt) endActivity(true);
    } else if (active.type === 'slide') {
      if (active.time < 1.2) {
        active.path.getPointAt(0, temp);
        actor.position.lerpVectors(active.start, temp, active.time / 1.2);
      } else {
        const t = Math.min(1, (active.time - 1.2) / 2);
        active.path.getPointAt(t, actor.position);
        active.path.getTangentAt(t, temp);
        actor.rotation.y = Math.atan2(temp.x, temp.z);
        $('#activity-instruction').textContent = '呼——滑下来啦！';
      }
      $('#activity-fill').style.width = `${Math.min(100, active.time / 3.2 * 100)}%`;
      if (active.time >= 3.2) { burst(actor.position, 0xffd273, 15, 3); endActivity(true); }
    } else if (active.type === 'seesaw') {
      const beam = active.object.mesh.userData.beam;
      const targetAngle = active.pulse * .28;
      beam.rotation.z = THREE.MathUtils.damp(beam.rotation.z, targetAngle, 4, dt);
      beam.updateWorldMatrix(true, false);
      temp.set(-2.55, .22, 0);
      beam.localToWorld(temp);
      actor.position.copy(temp);
      actor.rotation.y = Math.PI / 2;
      $('#activity-fill').style.width = `${Math.min(100, active.hits * 25)}%`;
      if (active.hits >= 4 && !active.endAt) { active.endAt = active.time + 1; toast('一上一下，真开心！', '跷跷板随时欢迎你再来玩。', 3); }
      if (active.endAt && active.time > active.endAt) endActivity(true);
    } else if (active.type === 'ducks') {
      if (Math.floor(active.time * 4) !== Math.floor((active.time - dt) * 4)) burst(active.object.position, 0xf3d68e, 5, 2);
      $('#activity-fill').style.width = `${Math.min(100, active.time / 3 * 100)}%`;
      active.object.mesh.children.forEach((duck, index) => {
        const start = active.duckStarts[index];
        const approach = Math.min(1, active.time / 2.5);
        duck.position.x = THREE.MathUtils.lerp(start.x, -1.6 + index * .65, approach);
        duck.position.z = THREE.MathUtils.lerp(start.z, 1.35, approach);
      });
      if (active.time > 3) { endActivity(true); toast('嘎嘎，谢谢你！', '小鸭子们吃饱啦。', 3); }
    }
  }

  function updateMovement(dt) {
    input.getMovement(movement);
    if (activity) { updateActivities(dt); return; }
    let dx = 0;
    let dz = 0;
    let speed = driving ? 12 : movement.running ? 8.2 : 5.3;
    if (Math.hypot(movement.x, movement.y) > .08) {
      stopRoute();
      dx = movement.x * Math.cos(cameraYaw) - movement.y * Math.sin(cameraYaw);
      dz = -movement.x * Math.sin(cameraYaw) - movement.y * Math.cos(cameraYaw);
    } else if (route) {
      let waypoint = route[routeIndex];
      while (waypoint && Math.hypot(waypoint.x - actor.position.x, waypoint.z - actor.position.z) < .32) waypoint = route[++routeIndex];
      if (!waypoint) { stopRoute(); save(); }
      else {
        dx = waypoint.x - actor.position.x;
        dz = waypoint.z - actor.position.z;
        const length = Math.hypot(dx, dz);
        dx /= length; dz /= length;
        speed = Math.min(driving ? 11 : 7.2, length / Math.max(dt, .001));
      }
    }
    const beforeX = actor.position.x;
    const beforeZ = actor.position.z;
    const nextX = beforeX + dx * speed * dt;
    const nextZ = beforeZ + dz * speed * dt;
    if (navigator.canStand(nextX, beforeZ, zone)) actor.position.x = nextX;
    if (navigator.canStand(actor.position.x, nextZ, zone)) actor.position.z = nextZ;
    const distance = Math.hypot(actor.position.x - beforeX, actor.position.z - beforeZ);
    if (route && distance < .001) { stuckTime += dt; if (stuckTime > 1.5) { stopRoute(); toast('前面有个小障碍', '换一个方向走几步，再让小路带你过去。'); } } else stuckTime = 0;
    if (distance > .001) {
      const angle = Math.atan2(dx, dz);
      actor.rotation.y += Math.atan2(Math.sin(angle - actor.rotation.y), Math.cos(angle - actor.rotation.y)) * Math.min(1, dt * 13);
      walkTime += distance * 2.9;
    }
    if (jumpVelocity !== 0 || jumpHeight > 0) {
      jumpVelocity -= 21 * dt;
      jumpHeight += jumpVelocity * dt;
      if (jumpHeight <= 0) {
        jumpHeight = jumpVelocity = 0;
        const puddle = registry.get('puddle');
        if (zone === 'outside' && Math.hypot(actor.position.x - puddle.position.x, actor.position.z - puddle.position.z) < puddle.radius) {
          if (actions.has('boots')) { emit('jump:puddle'); burst(actor.position, 0x9b6b43, 25, 4.4); sound('splash'); }
          else toast('跳泥坑要穿雨靴哦', '回家找到雨靴，再来痛快地跳吧。', 3);
        }
      }
    }
    actor.position.y = world.terrainHeight(actor.position.x, actor.position.z) + jumpHeight;
    const moving = distance > .001;
    const stride = moving ? Math.sin(walkTime) * .52 : 0;
    for (let index = 0; index < avatar.userData.legs.length; index++) avatar.userData.legs[index].rotation.x = THREE.MathUtils.damp(avatar.userData.legs[index].rotation.x, index ? -stride : stride, 15, dt);
    for (let index = 0; index < avatar.userData.arms.length; index++) avatar.userData.arms[index].rotation.x = THREE.MathUtils.damp(avatar.userData.arms[index].rotation.x, index ? stride * .65 : -stride * .65, 15, dt);
    avatar.position.y = moving && !jumpHeight ? Math.abs(Math.sin(walkTime)) * .06 : 0;
    if (driving) {
      car.mesh.position.copy(actor.position);
      car.position.copy(actor.position);
      car.mesh.rotation.y = actor.rotation.y;
      for (const wheel of car.mesh.userData.wheels || []) wheel.rotation.x += distance * 2.2;
      const arrival = registry.get('beach-arrival');
      if (distance > 0 && actor.position.distanceTo(arrival.position) < arrival.radius && !quest.counts['drive:beach']) {
        emit('drive:beach'); stopRoute(); toast('大海，我们来啦！', '按 E 停车下车，然后去沙滩找找小贝壳。', 5);
      }
    }
    if (kiteFlying && !driving && zone === 'outside' && moving) {
      kiteDistance += distance;
      if (kiteDistance >= 1) { const metres = Math.floor(kiteDistance); kiteDistance -= metres; emit('fly:kite', metres); }
    }
  }

  function updateCamera(dt, immediate = false) {
    cameraYaw -= input.orbit.x * .004;
    cameraPitch = THREE.MathUtils.clamp(cameraPitch + input.orbit.y * .003, .22, 1.15);
    cameraDistance = THREE.MathUtils.clamp(cameraDistance + input.orbit.zoom, 7, zone === 'inside' ? 23 : 29);
    input.orbit.x = input.orbit.y = input.orbit.zoom = 0;
    lookAt.copy(actor.position); lookAt.y += driving ? 1.5 : 1.7;
    const distance = cameraDistance;
    cameraDesired.set(lookAt.x + Math.sin(cameraYaw) * Math.cos(cameraPitch) * distance, lookAt.y + Math.sin(cameraPitch) * distance, lookAt.z + Math.cos(cameraYaw) * Math.cos(cameraPitch) * distance);
    if (zone === 'outside') cameraDesired.y = Math.max(cameraDesired.y, world.terrainHeight(cameraDesired.x, cameraDesired.z) + 1.3);
    if (immediate || reducedMotion) { camera.position.copy(cameraDesired); cameraLook.copy(lookAt); }
    else { const factor = 1 - Math.exp(-7 * dt); camera.position.lerp(cameraDesired, factor); cameraLook.lerp(lookAt, factor); }
    camera.lookAt(cameraLook);
  }

  function updateNearby() {
    target = resolveTarget();
    nearest = null;
    let closestScore = Infinity;
    if (!activity && !cameraMode && !driving) {
      for (const object of world.interactables) {
        if (object.zone !== zone || !object.mesh.visible || object.type === 'arrival') continue;
        const distance = Math.hypot(actor.position.x - object.position.x, actor.position.z - object.position.z);
        if (distance > object.radius) continue;
        const score = distance - (target?.id === object.id ? 1.2 : 0);
        if (score < closestScore) { nearest = object; closestScore = score; }
      }
    }
    const prompt = $('#interaction-prompt');
    prompt.hidden = Boolean((!nearest && !driving) || activity || cameraMode || dialog.open);
    if (driving) { $('#interaction-label').textContent = '停车下车'; $('#interaction-detail').textContent = '回到步行，继续探索'; }
    else if (nearest) {
      const descriptions = { npc: '和家人聊聊今天的冒险', door: zone === 'inside' ? '走出小黄屋，继续探索' : '客厅、厨房和卧室都在里面', pickup: '拾起并放进小背包', collect: '收进你的假期小收藏', water: '给花坛浇水', puddle: '穿好雨靴，按空格跳起来', swing: '坐上秋千，按节奏推三次', slide: '爬上梯子，再滑下来', seesaw: '按空格，一起上下摇摆', car: '坐上汽车，方向键开车', kite: '拿起风筝，迎着风奔跑', build: '放下一桶沙，垒起一座塔', photo: '进入相机，再按 E 拍照', picnic: '摆好蔬菜，邀请家人', lantern: '点亮回家的小灯', fireworks: '一起仰望假期的星空', ducks: '把面包屑轻轻撒到水面' };
      $('#interaction-label').textContent = nearest.label;
      $('#interaction-detail').textContent = descriptions[nearest.type] || '按 E 一起玩吧';
    }
    if (target) {
      const distance = Math.hypot(actor.position.x - target.position.x, actor.position.z - target.position.z);
      $('#target-distance').textContent = distance < 3 ? '就在身边' : `距离 ${Math.round(distance)} 米`;
      $('#guide-button').dataset.target = target.id;
    } else { $('#target-distance').textContent = '想怎么玩，都可以'; delete $('#guide-button').dataset.target; }
    let region = zone === 'inside' ? '小黄屋里面' : '佩奇的家';
    if (zone === 'outside') {
      let distance = Infinity;
      for (const place of world.locations) { const d = Math.hypot(actor.position.x - place.x, actor.position.z - place.z); if (d < distance) { distance = d; region = place.name; } }
    }
    $('#region-name').textContent = region;
    canvas.setAttribute('aria-label', `3D冒险场景。当前位置：${region}。${nearest ? `附近可互动：${nearest.label}。` : ''}WASD移动，空格跳跃，E互动。`);
    canvas.dataset.x = actor.position.x.toFixed(2);
    canvas.dataset.z = actor.position.z.toFixed(2);
    canvas.dataset.zone = zone;
    canvas.dataset.mode = driving ? 'driving' : activity?.type || 'walking';
    drawMap(mapContext, 240, false);
  }

  function drawMap(context, size, large) {
    const scale = size / 106;
    const px = x => (x + 53) * scale;
    const pz = z => (z + 51) * scale;
    context.clearRect(0, 0, size, size);
    context.fillStyle = '#a7cf7e'; context.fillRect(0, 0, size, size);
    context.fillStyle = '#b0d6e8'; context.fillRect(px(45), 0, size, size);
    context.fillStyle = '#f2dea4'; context.fillRect(px(30), pz(-12), 16 * scale, 58 * scale);
    context.lineCap = 'round'; context.lineJoin = 'round'; context.lineWidth = 3.5 * scale; context.strokeStyle = '#e7dfb1';
    context.beginPath(); context.moveTo(px(-28), pz(-20)); context.lineTo(px(0), pz(8)); context.lineTo(px(20), pz(-20)); context.moveTo(px(-25), pz(6)); context.lineTo(px(0), pz(8)); context.lineTo(px(34), pz(18)); context.stroke();
    context.fillStyle = '#80b9c7'; context.beginPath(); context.ellipse(px(-18), pz(32), 7 * scale, 4 * scale, -.3, 0, Math.PI * 2); context.fill();
    for (const place of world.locations) {
      context.fillStyle = place.id === 'home' ? '#e97985' : '#739956';
      context.strokeStyle = '#fff9'; context.lineWidth = 1.3 * scale;
      context.beginPath(); context.arc(px(place.x), pz(place.z), 2.1 * scale, 0, Math.PI * 2); context.fill(); context.stroke();
      if (large) { context.fillStyle = '#42653e'; context.font = `600 ${Math.round(size / 38)}px sans-serif`; context.textAlign = 'center'; context.fillText(place.name, px(place.x), pz(place.z) + 6 * scale); }
    }
    if (target?.zone === 'outside') { context.fillStyle = '#ffe38a'; context.beginPath(); context.arc(px(target.position.x), pz(target.position.z), 2.7 * scale, 0, Math.PI * 2); context.fill(); context.strokeStyle = '#b5943e'; context.lineWidth = .7 * scale; context.stroke(); }
    const x = zone === 'inside' ? 0 : actor.position.x;
    const z = zone === 'inside' ? 0 : actor.position.z;
    context.save(); context.translate(px(x), pz(z)); context.rotate(-actor.rotation.y + Math.PI);
    context.fillStyle = '#e25e90'; context.strokeStyle = 'white'; context.lineWidth = 1.1 * scale;
    context.beginPath(); context.moveTo(0, -3.7 * scale); context.lineTo(2.8 * scale, 2.6 * scale); context.lineTo(0, 1.4 * scale); context.lineTo(-2.8 * scale, 2.6 * scale); context.closePath(); context.fill(); context.stroke(); context.restore();
  }

  function updateEnvironment(dt) {
    const nightTarget = quest.counts['finale:fireworks'] ? 1 : quest.questIndex >= 13 ? .28 : 0;
    night = THREE.MathUtils.damp(night, nightTarget, .6, dt);
    scene.background.copy(skyDay).lerp(skyNight, night);
    scene.fog.color.copy(scene.background);
    skyLight.intensity = 2.5 - night * 1.2;
    sun.intensity = 2.8 - night * 2.4;
    sun.color.set(0xfff3d4).lerp(particleColor.set(0xc1d1ff), night);
    if (zone === 'inside') { sun.position.set(105, 45, 32); sun.target.position.set(120, 0, 0); }
    else { sun.position.set(actor.position.x - 25, 48, actor.position.z + 32); sun.target.position.set(actor.position.x, 0, actor.position.z); }
    $('#time-label').textContent = night > .7 ? '星光下的假期' : night > .12 ? '暖暖的傍晚' : '晴朗的早晨';
    if (target && target.zone === zone && !cameraMode) {
      marker.visible = true;
      marker.position.copy(target.position);
      diamond.position.y = 4.5 + (reducedMotion ? 0 : Math.sin(simTime * 2.5) * .16);
      diamond.rotation.y = simTime * .8;
      markerRing.position.y = .08;
    } else marker.visible = false;
    kite.visible = kiteString.visible = kiteFlying && zone === 'outside' && !driving && !activity;
    if (kite.visible) {
      kite.position.set(actor.position.x - 3.8 + Math.sin(simTime) * .4, actor.position.y + 6.8, actor.position.z - 2);
      kite.quaternion.copy(camera.quaternion);
      kite.rotation.z += Math.sin(simTime * 1.7) * .12;
      kiteStringPositions[0] = actor.position.x + .5; kiteStringPositions[1] = actor.position.y + 1.5; kiteStringPositions[2] = actor.position.z;
      kiteStringPositions[3] = kite.position.x; kiteStringPositions[4] = kite.position.y; kiteStringPositions[5] = kite.position.z;
      kiteStringGeometry.attributes.position.needsUpdate = true;
    }
    for (const id of ['mom', 'dad', 'george']) {
      const object = registry.get(id);
      const destination = object.mesh.userData.walkTarget;
      if (destination && object.mesh.position.distanceTo(destination) > .08) {
        temp.subVectors(destination, object.mesh.position);
        object.mesh.rotation.y = Math.atan2(temp.x, temp.z);
        object.mesh.position.addScaledVector(temp, Math.min(1, dt * 1.6));
        object.position.copy(object.mesh.position);
      }
    }
    if (finaleTime > 0) {
      const before = finaleTime;
      finaleTime -= dt;
      if (Math.floor(before * 2) !== Math.floor(finaleTime * 2)) {
        temp.set(actor.position.x + (Math.random() - .5) * 16, actor.position.y + 8 + Math.random() * 6, actor.position.z - 10);
        burst(temp, [0xffca80, 0xf09bcc, 0x9fe0f0, 0xd8eda0][Math.floor(Math.random() * 4)], 28, 3.5, .2);
      }
      if (finaleTime <= 0) {
        $('#mode-label').hidden = true;
        openDialog('我们一起的完美假期', `<section class="finale-view"><div class="finale-badge">${icon('star')}</div><h2>十四段冒险，一整个快乐假期</h2><p>从家门口出发，走过花园、游乐场和海滩。<br>最好的假期，就是和喜欢的人一起，把普通的一天变得闪闪发亮。</p><div class="dialog-buttons"><button class="primary-button" id="continue-exploring">继续自由探索</button><button class="secondary-button" id="finale-album">看看假期相册</button></div></section>`);
        $('#continue-exploring').onclick = closeDialog;
        $('#finale-album').onclick = openAlbum;
      }
    }
    world.update(simTime, dt);
  }

  let previousTime = performance.now();
  let frameId;
  function frame(now) {
    frameId = requestAnimationFrame(frame);
    const dt = Math.min(.04, Math.max(0, (now - previousTime) / 1000));
    previousTime = now;
    if (document.hidden) return;
    if (!dialog.open) {
      simTime += dt;
      updateMovement(dt);
      updateEnvironment(dt);
      updateParticles(dt);
      updateCamera(dt);
      uiTime += dt; saveTime += dt;
      if (uiTime > .12) { uiTime = 0; updateNearby(); }
      if (saveTime > 15) { saveTime = 0; save(); }
      if (toastRemaining > 0) { toastRemaining -= dt; if (toastRemaining <= 0) $('#toast').hidden = true; }
    }
    renderer.render(scene, camera);
  }
  function resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); }
  window.addEventListener('resize', resize);
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); previousTime = performance.now(); });
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); cancelAnimationFrame(frameId); $('#loading').hidden = false; $('#loading-message').textContent = '3D画面暂时中断，冒险进度已保存。正在等待画面恢复…'; save(); });
  canvas.addEventListener('webglcontextrestored', () => location.reload());
  updateQuestUI(); updateSound(); updateCamera(1, true); updateNearby();
  $('#loading').hidden = true; hud.hidden = false;
  frameId = requestAnimationFrame(frame);
  toast(saved ? '欢迎回到你的假期' : '假期，从家门口开始', 'WASD 移动，拖动看四周。点「带我过去」，就能找到第一段冒险。', 6);
  if (import.meta.hot) import.meta.hot.dispose(() => { cancelAnimationFrame(frameId); input.dispose(); renderer.dispose(); location.reload(); });
}

requestAnimationFrame(() => {
  try { boot(); }
  catch (error) {
    console.error(error);
    $('#loading').hidden = false;
    $('#loading-message').textContent = '假期世界没有成功打开。请刷新重试；如果仍然失败，请确认浏览器支持 WebGL。';
  }
});
