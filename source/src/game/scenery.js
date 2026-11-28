// Rich themed terrain, backgrounds, and decorative props for all 10 stages.
// Everything is baked into StaticBatcher buckets -> ZERO additional draw calls!

function addTree(b, x, y, z, scale = 1, leafColor = 0x56c77a, trunkColor = 0x9c6b49) {
  b.addCyl('matte', x, y + 0.9 * scale, z, 0.22 * scale, 1.8 * scale, trunkColor, 0, 0, 0, true);
  b.addSphere('matte', x, y + 2.2 * scale, z, 1.05 * scale, 0.92 * scale, 1.05 * scale, leafColor);
  b.addSphere('matte', x + 0.45 * scale, y + 2.6 * scale, z - 0.25 * scale, 0.72 * scale, 0.65 * scale, 0.72 * scale, leafColor);
}

function addPineTree(b, x, y, z, scale = 1, snow = false) {
  b.addCyl('matte', x, y + 0.55 * scale, z, 0.2 * scale, 1.1 * scale, 0x7b563c, 0, 0, 0, true);
  b.addCone('matte', x, y + 1.65 * scale, z, 1.1 * scale, 1.6 * scale, snow ? 0x6299a8 : 0x3a8c5c);
  b.addCone('matte', x, y + 2.55 * scale, z, 0.85 * scale, 1.45 * scale, snow ? 0x8cc2d4 : 0x4ca66f);
  b.addCone('matte', x, y + 3.35 * scale, z, 0.55 * scale, 1.15 * scale, snow ? 0xeaf7ff : 0x62bd83);
}

function addFlower(b, x, y, z, color) {
  b.addCyl('matte', x, y + 0.18, z, 0.04, 0.36, 0x47b568, 0, 0, 0, true);
  b.addSphere('matte', x, y + 0.42, z, 0.16, 0.12, 0.16, color);
}

function addCandyCane(b, x, y, z, scale = 1, yaw = 0) {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  for (let i = 0; i < 6; i++) {
    b.addCyl('glossy', x, y + (0.35 + i * 0.6) * scale, z, 0.22 * scale, 0.6 * scale, i % 2 === 0 ? 0xff4f86 : 0xffffff, 0, 0, 0, true);
  }
  // Curved hook top
  b.addSphere('glossy', x + cos * 0.35 * scale, y + 3.85 * scale, z + sin * 0.35 * scale, 0.24 * scale, 0.24 * scale, 0.24 * scale, 0xff4f86);
  b.addSphere('glossy', x + cos * 0.72 * scale, y + 3.65 * scale, z + sin * 0.72 * scale, 0.22 * scale, 0.22 * scale, 0.22 * scale, 0xffffff);
  b.addSphere('glossy', x + cos * 0.88 * scale, y + 3.25 * scale, z + sin * 0.88 * scale, 0.21 * scale, 0.21 * scale, 0.21 * scale, 0xff4f86);
}

function addGearDecor(b, x, y, z, r, axis = 'z', color = 0xd99b43) {
  const ry = axis === 'x' ? Math.PI / 2 : 0;
  b.addTorus('glossy', x, y, z, r, color, 0, ry, 0);
  b.addCyl('glossy', x, y, z, r * 0.35, 0.26, 0xb8762c, axis === 'z' ? Math.PI / 2 : 0, 0, axis === 'x' ? Math.PI / 2 : 0, true);
  const teeth = 8;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    if (axis === 'z') {
      b.addBox('glossy', x + Math.cos(a) * (r + 0.16), y + Math.sin(a) * (r + 0.16), z, 0.26, 0.26, 0.22, color, 0, 0, a);
    } else {
      b.addBox('glossy', x, y + Math.sin(a) * (r + 0.16), z + Math.cos(a) * (r + 0.16), 0.22, 0.26, 0.26, color, a, 0, 0);
    }
  }
}

export function buildAllStageScenery(b) {
  // =========================================================================
  // STAGE 1: 青空草原 (y = 0..10) — Hills, rocks, trees, flowers, distant mountains
  // =========================================================================
  // Distant pastel mountain ring around the entire tower
  const mtnCount = 16;
  for (let i = 0; i < mtnCount; i++) {
    const a = (i / mtnCount) * Math.PI * 2;
    const dist = 62 + (i % 3) * 8;
    const mx = 15 + Math.cos(a) * dist;
    const mz = -10 + Math.sin(a) * dist;
    const h = 16 + (i % 4) * 5.5;
    const r = 13 + (i % 3) * 4;
    b.addCone('scenery', mx, h * 0.45 - 1, mz, r, h, i % 2 === 0 ? 0x8ad6b8 : 0x9ce0c7);
    if (h > 22) {
      b.addCone('scenery', mx, h * 0.78 - 1, mz, r * 0.34, h * 0.34, 0xf2fbff);
    }
  }
  // Rolling grassy hills & rocks on the meadow (well clear of climb path)
  const hills = [
    [-12, 0, 4, 5.5, 2.0, 5.0],
    [10, 0, 6, 6.2, 2.4, 5.4],
    [-14, 0, -14, 7.0, 2.8, 6.5],
    [14, 0, -10, 6.0, 2.2, 5.5],
    [-10, 0, -28, 5.5, 2.0, 5.0],
    [22, 0, 14, 7.0, 2.5, 6.5],
  ];
  for (const [hx, hy, hz, sx, sy, sz] of hills) {
    b.addSphere('matte', hx, hy - sy * 0.25, hz, sx, sy, sz, 0x86dfad);
  }
  // Trees & flowers around Stage 1
  const s1Trees = [
    [-6.5, 0, 5.5, 1.1], [6.5, 0, 5.0, 1.2], [-7.5, 0, -4.0, 1.0],
    [7.2, 0, -6.0, 1.25], [-8.0, 0, -16.0, 1.15], [7.8, 0, -17.5, 1.0],
    [-6.0, 0, 12.0, 1.3], [9.0, 0, 11.5, 1.15],
  ];
  for (const [tx, ty, tz, s] of s1Trees) addTree(b, tx, ty, tz, s, 0x57ce7e);
  const flowerColors = [0xff6b9d, 0xffd166, 0x70c1ff, 0xffffff];
  for (let i = 0; i < 14; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    addFlower(b, side * (4.2 + (i % 4) * 1.1), 0, 7 - i * 2.1, flowerColors[i % 4]);
  }
  // Rocks near meadow
  b.addOcta('matte', -4.8, 0.35, 1.5, 0.9, 0.55, 0.8, 0xb8c5cc);
  b.addOcta('matte', 4.9, 0.4, -2.5, 1.0, 0.65, 0.85, 0xaab8c0);

  // =========================================================================
  // STAGE 2: お菓子工場 (y = 10..20, z=-26, x: 2.4..30) — Candy canes, macarons, frosting
  // =========================================================================
  // Tapered strawberry-wafer under-island crust
  b.addBox('matte', 16.5, 8.6, -26, 26.5, 1.8, 8.8, 0xf29cb8);
  // White frosting puffs along the edges of Stage 2 base
  for (let x = 4; x <= 28; x += 4) {
    b.addSphere('matte', x, 9.75, -30.7, 0.9, 0.55, 0.6, 0xfff8fb);
    b.addSphere('matte', x, 9.75, -21.3, 0.9, 0.55, 0.6, 0xfff8fb);
  }
  // Giant Candy Canes flanking the stage
  addCandyCane(b, 5.5, 10.0, -30.0, 1.15, 0.2);
  addCandyCane(b, 15.0, 10.0, -21.8, 1.25, -0.4);
  addCandyCane(b, 23.5, 10.0, -30.0, 1.2, 0.5);
  // Giant pastel Macaron stacks & Cupcake props
  const macarons = [[9.5, 10.0, -30.2, 0xff9ec4], [19.5, 10.0, -21.8, 0x9bf0d6], [27.5, 10.0, -29.8, 0xffe484]];
  for (const [mx, my, mz, mc] of macarons) {
    b.addCyl('matte', mx, my + 0.35, mz, 1.15, 0.45, mc);
    b.addCyl('matte', mx, my + 0.72, mz, 1.05, 0.32, 0xffffff);
    b.addCyl('matte', mx, my + 1.08, mz, 1.15, 0.45, mc);
    b.addSphere('glossy', mx, my + 1.52, mz, 0.3, 0.3, 0.3, 0xff3b6b); // cherry!
  }
  // Background sweet candy towers outside north edge
  b.addCyl('scenery', 12, 14, -40, 2.6, 12, 0xffb3d1, 0, 0, 0, true);
  b.addCone('scenery', 12, 22, -40, 3.2, 5.5, 0xfff5fa);
  b.addCyl('scenery', 24, 15, -42, 2.2, 14, 0xffd6e8, 0, 0, 0, true);
  b.addCone('scenery', 24, 24, -42, 2.8, 5.0, 0xff8ab8);

  // =========================================================================
  // STAGE 3: 浮遊諸島 (y = 20..30, x=30, z: -23.6..+6) — Floating rock cones & cloud sea
  // =========================================================================
  // Tapered floating island underside
  b.addCone('matte', 30, 17.0, -9, 6.2, 5.2, 0x9c8e82, Math.PI, 0, 0);
  b.addCone('matte', 30, 17.5, -18, 4.8, 4.4, 0x8f8175, Math.PI, 0, 0);
  b.addCone('matte', 30, 17.5, 1, 4.8, 4.4, 0x8f8175, Math.PI, 0, 0);
  // Satellite decorative floating islands in the sky around Stage 3
  const satIslands = [
    [40, 23, -18, 2.6], [42, 27, -6, 3.2], [39, 24, 5, 2.4],
    [20, 25, -12, 2.3], [44, 29, -14, 2.8],
  ];
  for (const [ix, iy, iz, ir] of satIslands) {
    b.addCyl('scenery', ix, iy, iz, ir, 0.9, 0x7ce098, 0, 0, 0, true);
    b.addCone('scenery', ix, iy - ir * 0.8, iz, ir * 0.95, ir * 1.4, 0xa09184, Math.PI, 0, 0);
    addTree(b, ix, iy + 0.45, iz, 0.72, 0x5fd484);
  }
  // Sea of white clouds cushioning below Stage 3
  for (let i = 0; i < 10; i++) {
    const cz = -22 + i * 3.2;
    const cx = 30 + (i % 2 === 0 ? 7.5 : -6.8);
    b.addSphere('scenery', cx, 18.8 + (i % 3) * 0.6, cz, 3.4, 1.4, 2.8, 0xf7fcff);
  }

  // =========================================================================
  // STAGE 4: 水上の港 (y = 30..40, z=+6, x: 27.6..0) — Harbour water, piers, lighthouse, boats
  // =========================================================================
  // Harbour wooden outer border rim around the aqua water basin
  b.addBox('matte', 13.8, 30.15, 11.2, 28.4, 0.8, 1.2, 0xc78f5c);
  b.addBox('matte', 13.8, 30.15, 0.8, 28.4, 0.8, 1.2, 0xc78f5c);
  // Wooden pier pilings along the water edge
  for (let x = 1; x <= 27; x += 4.3) {
    b.addCyl('matte', x, 30.5, 11.2, 0.22, 1.8, 0x8f5e38, 0, 0, 0, true);
    b.addCyl('matte', x, 30.5, 0.8, 0.22, 1.8, 0x8f5e38, 0, 0, 0, true);
  }
  // Red-and-white Lighthouse on the south harbour corner
  const lx = 24.5, ly = 30.0, lz = 12.2;
  b.addCyl('matte', lx, ly + 1.2, lz, 1.35, 2.4, 0xffffff);
  b.addCyl('matte', lx, ly + 3.4, lz, 1.15, 2.0, 0xff5468);
  b.addCyl('matte', lx, ly + 5.2, lz, 0.98, 1.6, 0xffffff);
  b.addCyl('emissive', lx, ly + 6.5, lz, 0.8, 1.0, 0xfff59e);
  b.addCone('matte', lx, ly + 7.6, lz, 1.05, 1.3, 0xff5468);
  // Cute docked pastel sailboats outside the harbour lane
  const boats = [[16, 30.1, 13.2, 0xff9f68], [6, 30.1, 13.0, 0x70c1ff]];
  for (const [bx, by, bz, bc] of boats) {
    b.addBox('scenery', bx, by + 0.2, bz, 3.0, 0.7, 1.3, bc);
    b.addCyl('scenery', bx, by + 1.8, bz, 0.08, 2.8, 0x99653c, 0, 0, 0, true);
    b.addCone('scenery', bx + 0.5, by + 2.1, bz, 0.9, 2.0, 0xffffff, 0, 0, -0.15);
  }

  // =========================================================================
  // STAGE 5: ツタの密林 (y = 40..50, x=0, z: +3.6..-26) — Jungle trees, vine arches, ruins
  // =========================================================================
  b.addBox('matte', 0, 38.7, -11, 9.6, 1.8, 28.0, 0x6b4f35);
  // Giant jungle trees flanking left & right of Stage 5
  const jTrees = [
    [-4.8, 40, 1, 1.35], [4.8, 40, -2, 1.4], [-5.2, 40, -10, 1.5],
    [5.0, 40, -13, 1.3], [-4.8, 40, -21, 1.4], [4.9, 40, -24, 1.25],
  ];
  for (const [tx, ty, tz, s] of jTrees) {
    addTree(b, tx, ty, tz, s, 0x2f9e59, 0x6e472b);
  }
  // Overhead vine canopy arches & dangling emerald vines
  for (const vz of [-4, -14, -22]) {
    b.addBox('matte', 0, 49.6, vz, 10.2, 0.45, 0.55, 0x3b8c4e);
    for (const vx of [-4.2, 4.2]) {
      b.addCyl('matte', vx, 46.8, vz, 0.12, 5.2, 0x45b864, 0, 0, 0, true);
    }
  }
  // Mossy temple ruin blocks & tropical blossoms
  b.addBox('matte', -4.2, 41.0, -6.5, 1.4, 2.0, 1.4, 0x8ea38b);
  b.addBox('matte', 4.3, 41.2, -17.5, 1.4, 2.4, 1.4, 0x8ea38b);
  for (let i = 0; i < 8; i++) {
    addFlower(b, (i % 2 === 0 ? -3.8 : 3.8), 40.0, 1 - i * 3.4, i % 2 === 0 ? 0xff5964 : 0xffe047);
  }

  // =========================================================================
  // STAGE 6: 氷の山 (y = 50..60, z=-26, x: 2.4..30) — Snowdrifts, ice crystals, snowy pines
  // =========================================================================
  b.addBox('matte', 16.5, 48.6, -26, 26.5, 1.8, 8.8, 0x92bdd9);
  // Giant glossy cyan ice crystal clusters around the mountain rim
  const crystals = [
    [6, 50, -30.5, 1.1, 4.2], [13, 50, -21.4, 1.3, 5.0],
    [21, 50, -30.6, 1.4, 5.4], [27, 50, -21.4, 1.2, 4.4],
    [16, 50, -31.2, 1.6, 6.2],
  ];
  for (const [cx, cy, cz, cr, ch] of crystals) {
    b.addCone('glossy', cx, cy + ch * 0.5, cz, cr, ch, 0x7be0ff, 0.1, 0, -0.08, true);
    b.addCone('glossy', cx + cr * 0.7, cy + ch * 0.32, cz + 0.3, cr * 0.65, ch * 0.65, 0xb8f0ff, -0.12, 0, 0.15, true);
  }
  // Snowy pines
  addPineTree(b, 8.5, 50.0, -21.6, 1.25, true);
  addPineTree(b, 18.0, 50.0, -30.2, 1.35, true);
  addPineTree(b, 25.0, 50.0, -30.2, 1.15, true);
  // Distant icy snow peaks backdrop
  b.addCone('scenery', 10, 56, -44, 9.0, 16, 0x7baad4);
  b.addCone('scenery', 10, 61.5, -44, 3.8, 6.5, 0xf0faff);
  b.addCone('scenery', 26, 58, -46, 10.5, 19, 0x6c9cc9);
  b.addCone('scenery', 26, 64.5, -46, 4.2, 7.5, 0xf0faff);

  // =========================================================================
  // STAGE 7: 炎の火山 (y = 60..70, x=30, z: -23.6..+6) — Basalt rocks, glowing lava rivers, volcano peaks
  // =========================================================================
  b.addBox('matte', 30, 58.6, -9, 9.6, 1.8, 28.0, 0x3b2c33);
  // Glowing molten lava streams inlaid slightly above dark basalt base (visual only, floor is solid at 60.0)
  b.addBox('emissive', 26.6, 60.02, -9, 1.4, 0.08, 25.0, 0xff5a1f);
  b.addBox('emissive', 33.4, 60.02, -9, 1.4, 0.08, 25.0, 0xff7b29);
  // Jagged volcanic basalt rocks & glowing magma spires
  const rocks = [
    [25.5, 60, -20, 1.8, 3.6], [34.5, 60, -16, 2.1, 4.4],
    [25.2, 60, -6, 2.0, 4.0], [34.6, 60, 2, 1.9, 3.8],
  ];
  for (const [rx, ry, rz, rr, rh] of rocks) {
    b.addCone('matte', rx, ry + rh * 0.5, rz, rr, rh, 0x4d373d, 0, 0, 0, true);
    b.addOcta('emissive', rx, ry + rh + 0.1, rz, 0.45, 0.6, 0.45, 0xff942e);
  }
  // Distant Volcano silhouette with glowing caldera & smoke puffs
  b.addCone('scenery', 48, 66, -10, 12.0, 18.0, 0x452c36);
  b.addSphere('emissive', 48, 74.8, -10, 2.6, 0.9, 2.6, 0xff5e1a);
  b.addSphere('scenery', 48, 78.0, -10, 2.8, 1.8, 2.8, 0x7a6872);
  b.addSphere('scenery', 49, 81.2, -9, 3.6, 2.0, 3.4, 0x917f89);

  // =========================================================================
  // STAGE 8: おもちゃ箱 (y = 70..80, z=+6, x: 27.6..0) — Giant toy blocks, studs, castle towers
  // =========================================================================
  b.addBox('matte', 13.8, 68.6, 6, 26.5, 1.8, 8.8, 0xffd166);
  // Giant colorful stacked building blocks & toy towers along sides
  const toyBlocks = [
    [24, 70, 10.6, 2.2, 2.2, 2.2, 0xff5964],
    [24, 72.2, 10.6, 1.8, 1.8, 1.8, 0x4cc9f0],
    [16, 70, 1.2, 2.4, 2.0, 2.4, 0x72efdd],
    [16, 72.0, 1.2, 1.6, 2.4, 1.6, 0xffbe0b],
    [7, 70, 10.6, 2.2, 2.6, 2.2, 0xb583ff],
    [7, 73.2, 10.6, 1.6, 2.2, 1.6, 0xff70a6],
  ];
  for (const [tx, ty, tz, tw, th, td, tc] of toyBlocks) {
    b.addBox('glossy', tx, ty + th * 0.5, tz, tw, th, td, tc);
    // Cute toy brick studs on top
    b.addCyl('glossy', tx - tw * 0.22, ty + th + 0.14, tz, 0.28, 0.28, tc, 0, 0, 0, true);
    b.addCyl('glossy', tx + tw * 0.22, ty + th + 0.14, tz, 0.28, 0.28, tc, 0, 0, 0, true);
  }
  // Giant toy castle turrets in south backdrop
  b.addCyl('scenery', 14, 75, 20, 3.0, 11, 0x80d4ff, 0, 0, 0, true);
  b.addCone('scenery', 14, 82.5, 20, 3.6, 5.2, 0xff5e8a);

  // =========================================================================
  // STAGE 9: 機械工場 (y = 80..90, x=0, z: +3.6..-26) — Steampunk gears, pipes, lanterns
  // =========================================================================
  b.addBox('matte', 0, 78.6, -11, 9.6, 1.8, 28.0, 0x525c73);
  // Giant decorative golden & copper gears flanking the factory
  addGearDecor(b, -5.2, 83.2, -2, 2.2, 'x', 0xe0a243);
  addGearDecor(b, 5.2, 85.0, -8, 2.6, 'x', 0xc97b42);
  addGearDecor(b, -5.2, 86.2, -16, 2.4, 'x', 0xebd078);
  addGearDecor(b, 5.2, 83.8, -22, 2.0, 'x', 0xd98f45);
  // Overhead brass steam pipe frames & warm glowing factory lanterns
  for (const pz of [-4, -13, -21]) {
    b.addCyl('glossy', -4.6, 84.5, pz, 0.24, 9.0, 0xb87b4b, 0, 0, 0, true);
    b.addCyl('glossy', 4.6, 84.5, pz, 0.24, 9.0, 0xb87b4b, 0, 0, 0, true);
    b.addBox('glossy', 0, 89.0, pz, 9.6, 0.36, 0.36, 0xcf8c55);
    b.addSphere('emissive', -4.0, 88.2, pz, 0.35, 0.42, 0.35, 0xffe48a);
    b.addSphere('emissive', 4.0, 88.2, pz, 0.35, 0.42, 0.35, 0xffe48a);
  }
  // Distant factory silhouettes west
  b.addBox('scenery', -16, 84, -12, 5.5, 10, 7.0, 0x454e66);
  b.addCyl('scenery', -16, 91.5, -14, 0.9, 6.0, 0x5c6680, 0, 0, 0, true);

  // =========================================================================
  // STAGE 10: 天空の王宮・最終決戦 (y = 90..100, center (15, 90, -10)) — Marble & gold palace
  // =========================================================================
  b.addBox('matte', 15, 88.4, -10, 22.8, 2.0, 24.8, 0xe8ddc5);
  // Classical white marble & gold colonnade around the Sky Palace perimeter
  const cols = [
    [4.5, -21.5], [10.0, -21.5], [15.5, -21.5], [21.0, -21.5], [25.5, -21.5],
    [25.5, -15.5], [25.5, -9.5], [25.5, -3.5], [25.5, 1.5],
    [20.0, 1.5], [14.5, 1.5], [9.0, 1.5], [4.5, 1.5],
    [4.5, -4.5], [4.5, -10.5], [4.5, -16.5],
  ];
  for (const [cx, cz] of cols) {
    b.addCyl('matte', cx, 93.2, cz, 0.42, 6.4, 0xfcfaf2, 0, 0, 0, true);
    b.addBox('glossy', cx, 90.2, cz, 1.15, 0.45, 1.15, 0xf2c94c);
    b.addBox('glossy', cx, 96.55, cz, 1.2, 0.42, 1.2, 0xf2c94c);
    b.addSphere('emissive', cx, 97.15, cz, 0.28, 0.28, 0.28, 0xfff3a8);
  }
  // Royal golden sky arches framing the 100m Crown summit
  b.addTorus('glossy', 15, 100.8, -10, 5.2, 0xffd147, 0, 0, 0);
  b.addTorus('glossy', 15, 100.8, -10, 5.2, 0xffd147, 0, Math.PI / 2, 0);
}
