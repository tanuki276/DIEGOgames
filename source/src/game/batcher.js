import * as THREE from 'three';

function mergeGeometriesWithColors(entries) {
  if (!entries.length) return null;

  let totalVerts = 0;
  const prepared = [];

  for (const { geo, matrix, color } of entries) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(matrix);
    if (!g.attributes.normal) g.computeVertexNormals();
    const pos = g.attributes.position;
    const norm = g.attributes.normal;
    totalVerts += pos.count;
    prepared.push({ pos, norm, count: pos.count, color });
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const colors = new Float32Array(totalVerts * 3);
  const c = new THREE.Color();

  let offset = 0;
  for (const item of prepared) {
    c.set(item.color);
    const pArr = item.pos.array;
    const nArr = item.norm.array;
    positions.set(pArr, offset * 3);
    normals.set(nArr, offset * 3);
    for (let i = 0; i < item.count; i++) {
      const k = (offset + i) * 3;
      colors[k] = c.r;
      colors[k + 1] = c.g;
      colors[k + 2] = c.b;
    }
    offset += item.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  merged.computeBoundingSphere();
  return merged;
}

export class StaticBatcher {
  constructor() {
    this.buckets = {
      matte: [],
      glossy: [],
      emissive: [],
      water: [],
      scenery: [],
    };
    this._dummy = new THREE.Object3D();

    // Shared unit primitive geometries (reused across all 10 stages!)
    this.unitBox = new THREE.BoxGeometry(1, 1, 1);
    this.unitCyl = new THREE.CylinderGeometry(1, 1, 1, 16);
    this.unitCylLow = new THREE.CylinderGeometry(1, 1, 1, 10);
    this.unitCone = new THREE.ConeGeometry(1, 1, 10);
    this.unitCone4 = new THREE.ConeGeometry(1, 1, 6);
    this.unitSphere = new THREE.SphereGeometry(1, 12, 9);
    this.unitOcta = new THREE.OctahedronGeometry(1, 0);
    this.unitTorus = new THREE.TorusGeometry(1, 0.16, 8, 18);
  }

  addGeo(bucket, geo, x, y, z, sx = 1, sy = 1, sz = 1, color = 0xffffff, rx = 0, ry = 0, rz = 0) {
    const d = this._dummy;
    d.position.set(x, y, z);
    d.rotation.set(rx, ry, rz);
    d.scale.set(sx, sy, sz);
    d.updateMatrix();
    this.buckets[bucket].push({
      geo,
      matrix: d.matrix.clone(),
      color,
    });
  }

  addBox(bucket, x, y, z, w, h, d, color, rx = 0, ry = 0, rz = 0) {
    this.addGeo(bucket, this.unitBox, x, y, z, w, h, d, color, rx, ry, rz);
  }

  addCyl(bucket, x, y, z, r, h, color, rx = 0, ry = 0, rz = 0, lowPoly = false) {
    this.addGeo(bucket, lowPoly ? this.unitCylLow : this.unitCyl, x, y, z, r, h, r, color, rx, ry, rz);
  }

  addCone(bucket, x, y, z, r, h, color, rx = 0, ry = 0, rz = 0, crystal = false) {
    this.addGeo(bucket, crystal ? this.unitCone4 : this.unitCone, x, y, z, r, h, r, color, rx, ry, rz);
  }

  addSphere(bucket, x, y, z, rxS, ryS, rzS, color) {
    this.addGeo(bucket, this.unitSphere, x, y, z, rxS, ryS, rzS, color);
  }

  addOcta(bucket, x, y, z, sx, sy, sz, color, rx = 0, ry = 0, rz = 0) {
    this.addGeo(bucket, this.unitOcta, x, y, z, sx, sy, sz, color, rx, ry, rz);
  }

  addTorus(bucket, x, y, z, r, color, rx = 0, ry = 0, rz = 0) {
    this.addGeo(bucket, this.unitTorus, x, y, z, r, r, r, color, rx, ry, rz);
  }

  // Add a cute beveled/trimmed pastel platform (box + middle accent trim band)
  addTrimmedBox(bucket, x, topY, z, w, h, d, color, trimColor) {
    const cy = topY - h * 0.5;
    // Slight chamfer visual via main body + slightly wider top cap & trim stripe
    this.addBox(bucket, x, cy, z, w, h, d, color);
    if (trimColor) {
      this.addBox(bucket, x, cy - h * 0.18, z, w + 0.06, Math.min(0.18, h * 0.28), d + 0.06, trimColor);
    }
  }

  addTrimmedCyl(bucket, x, topY, z, r, h, color, trimColor) {
    const cy = topY - h * 0.5;
    this.addCyl(bucket, x, cy, z, r, h, color);
    if (trimColor) {
      this.addCyl(bucket, x, cy - h * 0.18, z, r + 0.04, Math.min(0.18, h * 0.28), trimColor);
    }
  }

  // Add a themed stage entrance arch with 2 pillars + curved crown top
  addArch(bucket, x, baseY, z, yaw, colorA, colorB, width = 3.8, height = 3.4) {
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const hw = width * 0.5;
    for (const sign of [-1, 1]) {
      const px = x + cos * (sign * hw);
      const pz = z - sin * (sign * hw);
      this.addCyl(bucket, px, baseY + height * 0.5, pz, 0.22, height, colorA, 0, 0, 0, true);
      this.addSphere(bucket, px, baseY + height + 0.05, pz, 0.34, 0.34, 0.34, colorB);
    }
    this.addBox(bucket, x, baseY + height + 0.1, z, width + 0.3, 0.36, 0.44, colorB, 0, yaw, 0);
  }

  finalize(targetGroup) {
    const mats = {
      matte: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.54, metalness: 0.04 }),
      glossy: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.15, metalness: 0.22 }),
      emissive: new THREE.MeshBasicMaterial({ vertexColors: true }),
      water: new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.12,
        metalness: 0.18,
        transparent: true,
        opacity: 0.84,
      }),
      scenery: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.02 }),
    };

    const meshes = [];
    for (const key of Object.keys(this.buckets)) {
      const geo = mergeGeometriesWithColors(this.buckets[key]);
      if (!geo) continue;
      const mesh = new THREE.Mesh(geo, mats[key]);
      const isScenery = key === 'scenery' || key === 'emissive' || key === 'water';
      mesh.castShadow = !isScenery;
      mesh.receiveShadow = key !== 'emissive' && key !== 'scenery';
      targetGroup.add(mesh);
      meshes.push(mesh);
    }
    return meshes;
  }
}
