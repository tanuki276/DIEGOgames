import { PHYSICS, SPAWN_POS } from './constants.js';

export class PhysicsEngine {
  constructor(course, callbacks = {}) {
    this.course = course;
    this.cb = callbacks;

    this.state = {
      x: SPAWN_POS.x,
      y: SPAWN_POS.y,
      z: SPAWN_POS.z,
      vx: 0,
      vy: 0,
      vz: 0,
      grounded: false,
      groundPlat: null,
      coyoteTimer: 0,
      jumpBufferTimer: 0,
      bonkCooldown: 0,
      isDashing: false,
      hasMoved: false,
      finished: false,
      maxHeight: 0,
    };
  }

  reset() {
    this.state.x = SPAWN_POS.x;
    this.state.y = SPAWN_POS.y;
    this.state.z = SPAWN_POS.z;
    this.state.vx = 0;
    this.state.vy = 0;
    this.state.vz = 0;
    this.state.grounded = true;
    this.state.groundPlat = this.course.platforms[0] || null;
    this.state.coyoteTimer = PHYSICS.COYOTE_TIME;
    this.state.jumpBufferTimer = 0;
    this.state.bonkCooldown = 0;
    this.state.isDashing = false;
    this.state.hasMoved = false;
    this.state.finished = false;
    this.state.maxHeight = 0;
  }

  queueJump() {
    this.state.jumpBufferTimer = PHYSICS.JUMP_BUFFER;
  }

  // Evaluate top & bottom Y of a platform at (px, pz), or null if horizontally outside footprint
  _samplePlatformAt(p, px, pz, usePrev = false, padRadius = PHYSICS.PLAYER_RADIUS) {
    const cx = usePrev ? p.prevX : p.x;
    const cz = usePrev ? p.prevZ : p.z;
    const topY = usePrev ? p.prevTopY : p.topY;

    if (p.shape === 'box') {
      const hw = p.w * 0.5 + padRadius;
      const hd = p.d * 0.5 + padRadius;
      if (Math.abs(px - cx) <= hw && Math.abs(pz - cz) <= hd) {
        return { top: topY, bottom: topY - p.h };
      }
      return null;
    }

    if (p.shape === 'cylinder') {
      const dx = px - cx;
      const dz = pz - cz;
      const maxR = p.r + padRadius;
      if (dx * dx + dz * dz <= maxR * maxR) {
        return { top: topY, bottom: topY - p.h };
      }
      return null;
    }

    if (p.shape === 'seesaw') {
      const angle = usePrev ? p.prevAngle : p.angle;
      const hw = p.w * 0.5 + padRadius;
      const cosA = Math.cos(angle);
      const hdProj = p.d * 0.5 * cosA + padRadius;
      if (Math.abs(px - cx) <= hw && Math.abs(pz - cz) <= hdProj) {
        const hh = p.h * 0.5;
        const pivotCenterY = topY - hh;
        const dz = pz - cz;
        const surfTop = pivotCenterY + hh / Math.max(0.5, cosA) - dz * Math.tan(angle);
        const surfBot = pivotCenterY - hh / Math.max(0.5, cosA) - dz * Math.tan(angle);
        return { top: surfTop, bottom: surfBot };
      }
      return null;
    }

    return null;
  }

  // Find highest platform surface strictly at or below player's feet for drop shadow
  getShadowSurfaceY(x, y, z) {
    let bestY = null;
    for (const p of this.course.platforms) {
      const sample = this._samplePlatformAt(p, x, z, false, 0.12);
      if (sample && sample.top <= y + 0.15) {
        if (bestY === null || sample.top > bestY) {
          bestY = sample.top;
        }
      }
    }
    return bestY;
  }

  // Run one fixed physics substep (dt = 1/120 s)
  step(dt, input) {
    const s = this.state;
    if (s.bonkCooldown > 0) s.bonkCooldown = Math.max(0, s.bonkCooldown - dt);

    // 1. Advance moving platforms, seesaws, bars, pendulums
    this.course.stepPhysics(dt);

    // 2. Carry player with moving ground platform BEFORE player motion
    if (s.grounded && s.groundPlat) {
      const gp = s.groundPlat;
      const dxPlat = gp.x - gp.prevX;
      const dyPlat = gp.topY - gp.prevTopY;
      const dzPlat = gp.z - gp.prevZ;
      s.x += dxPlat;
      s.y += dyPlat;
      s.z += dzPlat;

      if (gp.spinOmega) {
        // Rotate player offset around rotating disc center (+Y rotation)
        const dTheta = gp.spinOmega * dt;
        const rx = s.x - gp.x;
        const rz = s.z - gp.z;
        const c = Math.cos(dTheta);
        const sn = Math.sin(dTheta);
        s.x = gp.x + rx * c + rz * sn;
        s.z = gp.z - rx * sn + rz * c;
      }

      if (gp.shape === 'seesaw') {
        // Apply player weight torque proportional to Z offset along seesaw
        const localZ = s.z - gp.z;
        gp.torqueInput += Math.max(-2.5, Math.min(2.5, localZ));
      }
    }

    // 3. Horizontal movement from camera-relative input
    const moveMag = Math.min(1, Math.hypot(input.moveX, input.moveZ));
    if (moveMag > 0.04 && !s.finished) {
      s.hasMoved = true;
    }

    const wantDash = input.dash && moveMag > 0.04;
    s.isDashing = wantDash;

    // Input moveX (+right), moveZ (+forward) rotated by camera yaw
    // Camera sits behind player along (+sin(yaw), +cos(yaw)), so camera forward is (-sin(yaw), -cos(yaw))
    const sinY = Math.sin(input.cameraYaw);
    const cosY = Math.cos(input.cameraYaw);
    const fwdX = -sinY;
    const fwdZ = -cosY;
    const rightX = cosY;
    const rightZ = -sinY;

    const worldInX = rightX * input.moveX + fwdX * input.moveZ;
    const worldInZ = rightZ * input.moveX + fwdZ * input.moveZ;
    const inLen = Math.hypot(worldInX, worldInZ);

    const maxSpeed = wantDash ? PHYSICS.DASH_SPEED : PHYSICS.WALK_SPEED;
    const targetVx = inLen > 0.001 ? (worldInX / inLen) * maxSpeed * moveMag : 0;
    const targetVz = inLen > 0.001 ? (worldInZ / inLen) * maxSpeed * moveMag : 0;

    if (s.bonkCooldown <= 0.16) {
      // Normal responsive movement (slightly reduced only during peak bonk knockback)
      if (s.grounded) {
        const accel = moveMag > 0.02 ? PHYSICS.GROUND_ACCEL : PHYSICS.GROUND_FRICTION * 4.2;
        const maxDelta = accel * dt;
        const dvx = targetVx - s.vx;
        const dvz = targetVz - s.vz;
        const dvLen = Math.hypot(dvx, dvz);
        if (dvLen <= maxDelta) {
          s.vx = targetVx;
          s.vz = targetVz;
        } else {
          s.vx += (dvx / dvLen) * maxDelta;
          s.vz += (dvz / dvLen) * maxDelta;
        }
      } else {
        if (moveMag > 0.02) {
          const maxDelta = PHYSICS.AIR_ACCEL * dt;
          const dvx = targetVx - s.vx;
          const dvz = targetVz - s.vz;
          const dvLen = Math.hypot(dvx, dvz);
          if (dvLen <= maxDelta) {
            s.vx = targetVx;
            s.vz = targetVz;
          } else {
            s.vx += (dvx / dvLen) * maxDelta;
            s.vz += (dvz / dvLen) * maxDelta;
          }
        } else {
          const drag = Math.max(0, 1 - PHYSICS.AIR_DRAG * dt);
          s.vx *= drag;
          s.vz *= drag;
        }
      }
    }

    // 4. Coyote time & Jump buffer
    if (s.grounded) {
      s.coyoteTimer = PHYSICS.COYOTE_TIME;
    } else {
      s.coyoteTimer = Math.max(0, s.coyoteTimer - dt);
    }

    if (s.jumpBufferTimer > 0) {
      s.jumpBufferTimer = Math.max(0, s.jumpBufferTimer - dt);
    }

    if (s.jumpBufferTimer > 0 && s.coyoteTimer > 0 && !s.finished) {
      s.vy = PHYSICS.JUMP_VY;
      s.grounded = false;
      s.groundPlat = null;
      s.coyoteTimer = 0;
      s.jumpBufferTimer = 0;
      s.hasMoved = true;
      if (this.cb.onJump) this.cb.onJump(false);
    }

    // 5. Gravity & Position integration (save prevY for swept landing!)
    const prevY = s.y;
    if (!s.grounded) {
      s.vy = Math.max(-PHYSICS.MAX_FALL_SPEED, s.vy - PHYSICS.GRAVITY * dt);
    }

    s.x += s.vx * dt;
    s.z += s.vz * dt;
    s.y += s.vy * dt;

    // 6. Side-wall collision pushout (for boxes and solid cylinders)
    this._resolveSideWalls(s);

    // 7. Swept vertical landing & ceiling detection
    const wasGrounded = s.grounded;
    const impactVy = -s.vy;
    let landedPlat = null;
    let landedTopY = -Infinity;

    // If previously grounded on a platform, check if still on it (handles tilting seesaws & slopes cleanly)
    if (wasGrounded && s.groundPlat && s.vy <= 0.05) {
      const gp = s.groundPlat;
      const cur = this._samplePlatformAt(gp, s.x, s.z, false, PHYSICS.PLAYER_RADIUS);
      if (cur && Math.abs(s.y - cur.top) <= 0.28) {
        landedPlat = gp;
        landedTopY = cur.top;
      }
    }

    // Swept check against ALL platforms (catches high-speed falls through thin beams/platforms!)
    for (const p of this.course.platforms) {
      const cur = this._samplePlatformAt(p, s.x, s.z, false, PHYSICS.PLAYER_RADIUS);
      if (!cur) continue;

      const prevSample = this._samplePlatformAt(p, s.x, s.z, true, PHYSICS.PLAYER_RADIUS);
      const prevTop = prevSample ? prevSample.top : cur.top;
      const prevBot = prevSample ? prevSample.bottom : cur.bottom;
      const platVy = (cur.top - prevTop) / dt;

      // Swept top landing: player feet crossed from above prevTop to at/below cur.top
      const relVy = s.vy - platVy;
      const stepTolerance = p.isBouncePad ? p.h + 0.16 : (wasGrounded ? 0.24 : 0.14);
      if (relVy <= 0.2 && prevY >= prevTop - stepTolerance && s.y <= cur.top + 0.08) {
        if (cur.top > landedTopY) {
          landedTopY = cur.top;
          landedPlat = p;
        }
      }

      // Swept ceiling bump (only when rising upward)
      const prevHead = prevY + PHYSICS.PLAYER_HEIGHT;
      const curHead = s.y + PHYSICS.PLAYER_HEIGHT;
      if (s.vy > 0 && prevHead <= prevBot + 0.12 && curHead >= cur.bottom) {
        s.y = cur.bottom - PHYSICS.PLAYER_HEIGHT - 0.01;
        s.vy = Math.min(0, platVy);
      }
    }

    if (landedPlat) {
      s.y = landedTopY;
      // Check Bounce Pad!
      if (landedPlat.isBouncePad) {
        s.vy = landedPlat.bounceVy;
        s.grounded = false;
        s.groundPlat = null;
        s.coyoteTimer = 0;
        this.course.triggerBounceVisual(landedPlat);
        if (this.cb.onBounce) this.cb.onBounce(landedPlat);
      } else {
        s.vy = 0;
        s.grounded = true;
        s.groundPlat = landedPlat;
        if (!wasGrounded && impactVy > 2.2 && this.cb.onLand) {
          this.cb.onLand(impactVy);
        }
      }
    } else {
      s.grounded = false;
      s.groundPlat = null;
    }

    // 8. Hazard collisions (Rotating Sweeper Bar + Pendulum Hammer)
    this._resolveHazards(s);

    // 9. Safety floor net if somehow knocked far outside the 68m ground cylinder
    if (s.y < -8.0) {
      s.x = SPAWN_POS.x;
      s.y = SPAWN_POS.y + 0.5;
      s.z = SPAWN_POS.z;
      s.vx = 0;
      s.vy = 0;
      s.vz = 0;
      s.grounded = false;
      s.groundPlat = null;
    }

    // 10. Track max height
    if (s.y > s.maxHeight) {
      s.maxHeight = s.y;
    }

    // 11. Milestone flags
    if (!s.finished) {
      for (const f of this.course.flags) {
        if (f.reached) continue;
        const dx = s.x - f.x;
        const dz = s.z - f.z;
        const dy = s.y - f.y;
        if (dx * dx + dz * dz <= 2.35 * 2.35 && dy >= -0.6 && dy <= 2.4) {
          f.reached = true;
          f.popAnim = 1.0;
          f.pennantMat.color.setHex(0xffcf33);
          if (this.cb.onFlagReached) this.cb.onFlagReached(f);
        }
      }

      // 12. Floating Crown Goal check!
      const cp = this.course.crownPos;
      const dx = s.x - cp.x;
      const dy = (s.y + PHYSICS.PLAYER_HEIGHT * 0.5) - cp.y;
      const dz = s.z - cp.z;
      if (dx * dx + dy * dy + dz * dz <= 1.65 * 1.65) {
        s.finished = true;
        if (this.cb.onGoalReached) this.cb.onGoalReached();
      }
    }
  }

  _resolveSideWalls(s) {
    const r = PHYSICS.PLAYER_RADIUS;
    const pBot = s.y + 0.22; // Leave small step clearance near feet
    const pTop = s.y + PHYSICS.PLAYER_HEIGHT - 0.08;

    for (const p of this.course.platforms) {
      if (p.shape === 'seesaw' || p.isGround || p.isBouncePad) continue;
      const platTop = p.topY;
      const platBot = p.topY - p.h;
      // Only push horizontally if player body overlaps side vertically
      if (pTop <= platBot || pBot >= platTop - 0.06) continue;

      if (p.shape === 'box') {
        const hw = p.w * 0.5;
        const hd = p.d * 0.5;
        const closestX = Math.max(p.x - hw, Math.min(s.x, p.x + hw));
        const closestZ = Math.max(p.z - hd, Math.min(s.z, p.z + hd));
        const dx = s.x - closestX;
        const dz = s.z - closestZ;
        const distSq = dx * dx + dz * dz;
        if (distSq < r * r) {
          if (distSq > 1e-6) {
            const dist = Math.sqrt(distSq);
            const push = r - dist;
            const nx = dx / dist;
            const nz = dz / dist;
            s.x += nx * push;
            s.z += nz * push;
            const vn = s.vx * nx + s.vz * nz;
            if (vn < 0) {
              s.vx -= vn * nx;
              s.vz -= vn * nz;
            }
          } else {
            // Center inside box: push out along shallowest axis
            const ox = hw + r - Math.abs(s.x - p.x);
            const oz = hd + r - Math.abs(s.z - p.z);
            if (ox < oz) {
              const sign = s.x >= p.x ? 1 : -1;
              s.x += sign * ox;
              if (s.vx * sign < 0) s.vx = 0;
            } else {
              const sign = s.z >= p.z ? 1 : -1;
              s.z += sign * oz;
              if (s.vz * sign < 0) s.vz = 0;
            }
          }
        }
      } else if (p.shape === 'cylinder') {
        const dx = s.x - p.x;
        const dz = s.z - p.z;
        const minR = p.r + r;
        const distSq = dx * dx + dz * dz;
        if (distSq < minR * minR && distSq > 1e-6) {
          const dist = Math.sqrt(distSq);
          const push = minR - dist;
          const nx = dx / dist;
          const nz = dz / dist;
          s.x += nx * push;
          s.z += nz * push;
          const vn = s.vx * nx + s.vz * nz;
          if (vn < 0) {
            s.vx -= vn * nx;
            s.vz -= vn * nz;
          }
        }
      }
    }
  }

  _resolveHazards(s) {
    if (s.bonkCooldown > 0) return;

    const pBot = s.y;
    const pTop = s.y + PHYSICS.PLAYER_HEIGHT;
    const r = PHYSICS.PLAYER_RADIUS;

    // 1. Rotating Sweeper Bars
    for (const b of this.course.rotatingBars) {
      if (pTop < b.y - b.barRadius || pBot > b.y + b.barRadius) continue;

      // Bar axis direction in XZ (matches Three.js rotation.y = b.angle)
      const dirX = Math.cos(b.angle);
      const dirZ = -Math.sin(b.angle);
      const rx = s.x - b.x;
      const rz = s.z - b.z;
      const proj = rx * dirX + rz * dirZ;
      const clamped = Math.max(-b.halfLength, Math.min(b.halfLength, proj));

      const closestX = b.x + dirX * clamped;
      const closestZ = b.z + dirZ * clamped;
      const dx = s.x - closestX;
      const dz = s.z - closestZ;
      const hitDist = r + b.barRadius;

      if (dx * dx + dz * dz < hitDist * hitDist) {
        // Compute bar tangential sweep velocity at contact point (clamped)
        const tanX = -Math.sin(b.angle) * b.omega * clamped;
        const tanZ = -Math.cos(b.angle) * b.omega * clamped;
        const outLen = Math.hypot(dx, dz) || 1;
        const pushX = (dx / outLen) * 4.5 + tanX * 1.1;
        const pushZ = (dz / outLen) * 4.5 + tanZ * 1.1;
        const pLen = Math.hypot(pushX, pushZ) || 1;
        const knockSpeed = 8.8;

        s.vx = (pushX / pLen) * knockSpeed;
        s.vz = (pushZ / pLen) * knockSpeed;
        s.vy = Math.max(s.vy, 4.4);
        s.grounded = false;
        s.groundPlat = null;
        s.bonkCooldown = 0.34;
        if (this.cb.onBonk) this.cb.onBonk();
        return;
      }
    }

    // 2. Pendulum Hammers
    for (const h of this.course.pendulums) {
      const playerMidY = s.y + PHYSICS.PLAYER_HEIGHT * 0.5;
      const dy = playerMidY - h.headY;
      const dz = s.z - h.headZ;
      const dx = s.x - h.headX;
      const hitY = PHYSICS.PLAYER_HEIGHT * 0.45 + h.headRadius;
      const hitZ = r + h.headRadius;
      const hitX = r + h.headHalfLen;

      if (Math.abs(dy) < hitY && Math.abs(dz) < hitZ && Math.abs(dx) < hitX) {
        const swingDir = h.angle >= h.prevAngle ? 1 : -1;
        s.vx = swingDir * 7.8;
        s.vz += (dz >= 0 ? 1 : -1) * 1.5;
        s.vy = Math.max(s.vy, 4.0);
        s.grounded = false;
        s.groundPlat = null;
        s.bonkCooldown = 0.38;
        if (this.cb.onBonk) this.cb.onBonk();
        return;
      }
    }
  }
}
