export function createInput({ canvas, onInteract, onJump, onShortcut, isBlocked }) {
  const controller = new AbortController();
  const options = { signal: controller.signal };
  const keys = new Set();
  const stick = { x: 0, y: 0 };
  const orbit = { x: 0, y: 0, zoom: 0 };
  const joystick = document.querySelector('#joystick');
  const knob = document.querySelector('#joystick-knob');
  let cameraPointer = null;
  let joystickPointer = null;
  let lastX = 0;
  let lastY = 0;

  function reset() {
    keys.clear();
    stick.x = stick.y = 0;
    orbit.x = orbit.y = orbit.zoom = 0;
    joystickPointer = cameraPointer = null;
    knob.style.transform = '';
  }

  document.addEventListener('keydown', event => {
    if (event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    if (isBlocked()) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    keys.add(event.code);
    if (event.repeat) return;
    if (event.code === 'Space') onJump();
    else if (event.code === 'KeyE') { event.preventDefault(); onInteract(); }
    else if (['Escape', 'KeyJ', 'KeyM', 'KeyP', 'KeyK'].includes(event.code)) onShortcut(event.code);
  }, options);
  document.addEventListener('keyup', event => keys.delete(event.code), options);
  window.addEventListener('blur', reset, options);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); }, options);

  canvas.addEventListener('pointerdown', event => {
    if (isBlocked() || cameraPointer !== null || event.button > 0) return;
    canvas.focus({ preventScroll: true });
    cameraPointer = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  }, options);
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== cameraPointer || isBlocked()) return;
    orbit.x += event.clientX - lastX;
    orbit.y += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  }, options);
  const releaseCamera = event => { if (event.pointerId === cameraPointer) cameraPointer = null; };
  canvas.addEventListener('pointerup', releaseCamera, options);
  canvas.addEventListener('pointercancel', releaseCamera, options);
  canvas.addEventListener('lostpointercapture', releaseCamera, options);
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    if (!isBlocked()) orbit.zoom += event.deltaY * .012;
  }, { ...options, passive: false });
  canvas.addEventListener('contextmenu', event => event.preventDefault(), options);

  function moveStick(event) {
    const box = joystick.getBoundingClientRect();
    const radius = box.width * .31;
    let x = (event.clientX - box.left - box.width / 2) / radius;
    let y = (event.clientY - box.top - box.height / 2) / radius;
    const length = Math.hypot(x, y);
    if (length > 1) { x /= length; y /= length; }
    stick.x = x;
    stick.y = -y;
    knob.style.transform = `translate(${x * radius}px, ${y * radius}px)`;
  }
  joystick.addEventListener('pointerdown', event => {
    if (isBlocked() || joystickPointer !== null) return;
    event.preventDefault();
    joystickPointer = event.pointerId;
    joystick.setPointerCapture(event.pointerId);
    moveStick(event);
  }, options);
  joystick.addEventListener('pointermove', event => {
    if (event.pointerId === joystickPointer) moveStick(event);
  }, options);
  const releaseStick = event => {
    if (event.pointerId !== joystickPointer) return;
    joystickPointer = null;
    stick.x = stick.y = 0;
    knob.style.transform = '';
  };
  joystick.addEventListener('pointerup', releaseStick, options);
  joystick.addEventListener('pointercancel', releaseStick, options);
  joystick.addEventListener('lostpointercapture', releaseStick, options);
  document.querySelector('#jump-button').addEventListener('click', () => { if (!isBlocked()) onJump(); }, options);
  for (const id of ['interact-button', 'interact-prompt-button']) {
    document.getElementById(id).addEventListener('click', () => { if (!isBlocked()) onInteract(); }, options);
  }

  return {
    orbit,
    getMovement(out) {
      if (isBlocked()) { out.x = out.y = 0; out.running = false; return out; }
      out.x = stick.x + Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
      out.y = stick.y + Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
      const length = Math.hypot(out.x, out.y);
      if (length > 1) { out.x /= length; out.y /= length; }
      out.running = keys.has('ShiftLeft') || keys.has('ShiftRight') || Math.hypot(stick.x, stick.y) > .82;
      return out;
    },
    reset,
    dispose() { controller.abort(); reset(); },
  };
}
