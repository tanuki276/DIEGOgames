export class InputController {
  constructor(canvas, ui, callbacks = {}) {
    this.canvas = canvas;
    this.ui = ui;
    this.cb = callbacks;

    this.cameraYaw = 0;      // 0 = looking North (-Z)
    this.cameraPitch = 0.34;

    this.keys = new Set();

    // Multi-touch isolated tracking
    this.stickTouchId = null;
    this.stickOriginX = 0;
    this.stickOriginY = 0;
    this.stickX = 0;
    this.stickY = 0;
    this.stickDash = false;
    this.stickMaxRadius = 54;

    this.lookTouchId = null;
    this.lookLastX = 0;
    this.lookLastY = 0;

    this.isMouseDragging = false;
    this.mouseLastX = 0;
    this.mouseLastY = 0;
    this.isPointerLocked = false;

    this.touchDetected =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

    this._bindEvents();
    this._updateTouchUIState();
  }

  resetCamera() {
    this.cameraYaw = 0;
    this.cameraPitch = 0.34;
  }

  _updateTouchUIState() {
    if (this.ui.touchLayer) {
      this.ui.touchLayer.classList.toggle('touch-active', this.touchDetected);
    }
    if (this.ui.pointerHint) {
      this.ui.pointerHint.style.display = this.touchDetected || this.isPointerLocked ? 'none' : 'flex';
    }
  }

  _triggerJump() {
    if (this.cb.onAnyInput) this.cb.onAnyInput();
    if (this.cb.onJumpPress) this.cb.onJumpPress();
  }

  _bindEvents() {
    window.addEventListener('keydown', (e) => {
      if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      if (this.cb.onAnyInput) this.cb.onAnyInput();
      if (e.code === 'Space' && !e.repeat) {
        this._triggerJump();
      }
      this.keys.add(e.code);
    }, { passive: false });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.isMouseDragging = false;
      this._resetStick();
      this.lookTouchId = null;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (this.cb.onAnyInput) this.cb.onAnyInput();
      if (!this.touchDetected && document.pointerLockElement !== this.canvas) {
        if (this.canvas.requestPointerLock) {
          try {
            const p = this.canvas.requestPointerLock();
            if (p && typeof p.catch === 'function') p.catch(() => {});
          } catch {}
        }
      }
      this.isMouseDragging = true;
      this.mouseLastX = e.clientX;
      this.mouseLastY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDragging = false;
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === this.canvas;
      this._updateTouchUIState();
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPointerLocked) {
        this._rotateCamera(e.movementX, e.movementY, 0.0026);
      } else if (this.isMouseDragging) {
        const dx = e.clientX - this.mouseLastX;
        const dy = e.clientY - this.mouseLastY;
        this.mouseLastX = e.clientX;
        this.mouseLastY = e.clientY;
        this._rotateCamera(dx, dy, 0.0055);
      }
    });

    const jumpBtn = this.ui.jumpBtn;
    if (jumpBtn) {
      jumpBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.touchDetected = true;
        this._updateTouchUIState();
        jumpBtn.classList.add('pressed');
        this._triggerJump();
      }, { passive: false });

      jumpBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        jumpBtn.classList.remove('pressed');
      }, { passive: false });

      jumpBtn.addEventListener('touchcancel', () => {
        jumpBtn.classList.remove('pressed');
      });

      jumpBtn.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        jumpBtn.classList.add('pressed');
        this._triggerJump();
      });

      window.addEventListener('mouseup', () => {
        jumpBtn.classList.remove('pressed');
      });
    }

    const touchTarget = this.ui.touchCatcher || this.canvas;
    touchTarget.addEventListener('touchstart', (e) => {
      if (e.target && e.target.closest && e.target.closest('button, input, a, .modal-card')) return;
      e.preventDefault();
      if (!this.touchDetected) {
        this.touchDetected = true;
        this._updateTouchUIState();
      }
      if (this.cb.onAnyInput) this.cb.onAnyInput();

      const halfW = window.innerWidth * 0.5;
      for (const t of e.changedTouches) {
        if (t.clientX < halfW && this.stickTouchId === null) {
          this.stickTouchId = t.identifier;
          this.stickOriginX = t.clientX;
          this.stickOriginY = t.clientY;
          this.stickX = 0;
          this.stickY = 0;
          this.stickDash = false;
          this._renderJoystick(true, t.clientX, t.clientY, 0, 0, false);
        } else if (t.clientX >= halfW && this.lookTouchId === null) {
          this.lookTouchId = t.identifier;
          this.lookLastX = t.clientX;
          this.lookLastY = t.clientY;
        }
      }
    }, { passive: false });

    touchTarget.addEventListener('touchmove', (e) => {
      if (this.stickTouchId === null && this.lookTouchId === null) return;
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === this.stickTouchId) {
          const rawDx = t.clientX - this.stickOriginX;
          const rawDy = t.clientY - this.stickOriginY;
          const dist = Math.hypot(rawDx, rawDy);
          const maxR = this.stickMaxRadius;
          const clampedDist = Math.min(dist, maxR);
          const nx = dist > 1 ? rawDx / dist : 0;
          const ny = dist > 1 ? rawDy / dist : 0;
          const normMag = clampedDist / maxR;

          if (normMag < 0.12) {
            this.stickX = 0;
            this.stickY = 0;
            this.stickDash = false;
          } else {
            this.stickX = nx * normMag;
            this.stickY = -ny * normMag;
            this.stickDash = normMag >= 0.76;
          }

          this._renderJoystick(
            true,
            this.stickOriginX,
            this.stickOriginY,
            nx * clampedDist,
            ny * clampedDist,
            this.stickDash
          );
        } else if (t.identifier === this.lookTouchId) {
          const dx = t.clientX - this.lookLastX;
          const dy = t.clientY - this.lookLastY;
          this.lookLastX = t.clientX;
          this.lookLastY = t.clientY;
          this._rotateCamera(dx, dy, 0.0068);
        }
      }
    }, { passive: false });

    const onTouchEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.stickTouchId) this._resetStick();
        if (t.identifier === this.lookTouchId) this.lookTouchId = null;
      }
    };

    touchTarget.addEventListener('touchend', onTouchEnd, { passive: false });
    touchTarget.addEventListener('touchcancel', onTouchEnd, { passive: false });
  }

  _resetStick() {
    this.stickTouchId = null;
    this.stickX = 0;
    this.stickY = 0;
    this.stickDash = false;
    this._renderJoystick(false, 0, 0, 0, 0, false);
  }

  _renderJoystick(active, ox, oy, kx, ky, isDash) {
    const { joyBase, joyKnob, joyDashBadge } = this.ui;
    if (!joyBase || !joyKnob) return;
    if (active) {
      joyBase.classList.add('active');
      joyBase.classList.toggle('dashing', isDash);
      joyBase.style.left = `${ox}px`;
      joyBase.style.top = `${oy}px`;
      joyKnob.style.transform = `translate(${kx}px, ${ky}px)`;
      if (joyDashBadge) joyDashBadge.style.opacity = isDash ? '1' : '0';
    } else {
      joyBase.classList.remove('active', 'dashing');
      joyKnob.style.transform = 'translate(0px, 0px)';
      if (joyDashBadge) joyDashBadge.style.opacity = '0';
    }
  }

  _rotateCamera(dx, dy, sensitivity) {
    this.cameraYaw -= dx * sensitivity;
    this.cameraPitch = Math.max(-0.18, Math.min(1.18, this.cameraPitch + dy * sensitivity));
  }

  getInput() {
    let moveX = 0;
    let moveZ = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) moveX -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) moveX += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) moveZ += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) moveZ -= 1;

    const kbLen = Math.hypot(moveX, moveZ);
    if (kbLen > 1) {
      moveX /= kbLen;
      moveZ /= kbLen;
    }

    const kbDash = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const stickActive = this.stickTouchId !== null && (Math.abs(this.stickX) > 0.01 || Math.abs(this.stickY) > 0.01);
    if (stickActive) {
      moveX = this.stickX;
      moveZ = this.stickY;
    }

    return {
      moveX,
      moveZ,
      dash: kbDash || this.stickDash,
      cameraYaw: this.cameraYaw,
      cameraPitch: this.cameraPitch,
    };
  }
}
