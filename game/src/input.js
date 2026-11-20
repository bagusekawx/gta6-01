// Keyboard + mouse state. The game reads keys() each frame; edge-triggered
// actions use pressed(), which is true only on the frame the key went down.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.justPressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.locked = false;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.code;
      this.down.add(k);
      this.justPressed.add(k);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => { this.down.clear(); });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    });
    canvas.addEventListener('mousedown', (e) => {
      this.mouseDown = true;
      this.mouseClicked = true;
      if (e.button === 0 && !this.locked) canvas.requestPointerLock?.();
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
  }

  key(code) { return this.down.has(code); }
  pressed(code) { return this.justPressed.has(code); }
  any(...codes) { return codes.some((c) => this.down.has(c)); }
  consumeMouse() {
    const dx = this.mouseDX, dy = this.mouseDY;
    this.mouseDX = 0; this.mouseDY = 0;
    return { dx, dy };
  }
  endFrame() {
    this.justPressed.clear();
    this.mouseClicked = false;
  }
}
