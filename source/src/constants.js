export const PHYSICS = {
  WALK_SPEED: 6.0,       // m/s
  DASH_SPEED: 9.5,       // m/s
  GRAVITY: 26.0,         // m/s^2
  JUMP_VY: 10.5,         // m/s (apex ~2.12m)
  COYOTE_TIME: 0.12,     // seconds
  JUMP_BUFFER: 0.12,     // seconds
  BOUNCE_VY: 16.5,       // m/s (apex ~5.24m)
  PLAYER_RADIUS: 0.36,   // horizontal collision radius (m)
  PLAYER_HEIGHT: 1.15,   // character height (m)
  MAX_FALL_SPEED: 38.0,  // terminal fall speed (m/s)
  GROUND_ACCEL: 54.0,    // snappy ground response
  AIR_ACCEL: 30.0,       // responsive mid-air steering for bounce drifts
  GROUND_FRICTION: 16.0, // crisp stopping on narrow beams
  AIR_DRAG: 1.6,         // gentle air drag when no directional input
  FIXED_DT: 1 / 120,     // 120Hz physics substeps
};

export const GOAL_HEIGHT = 34.6;

export const SPAWN_POS = { x: 0, y: 0.0, z: 2.2 };

export const PALETTE = {
  skyTop: 0x5cc4ff,
  skyBottom: 0xdff5ff,
  ground: 0x9be7c4,
  groundRim: 0x76d6aa,
  groundPattern: 0xb6f2d6,
  sec1: 0xffb38a, // Peach / Apricot
  sec1Trim: 0xff9362,
  sec2: 0xffe478, // Buttercup Yellow
  sec2Trim: 0xffcf48,
  sec3: 0x7de8d2, // Mint Aqua
  sec3Trim: 0x4fd4ba,
  sec4: 0xff8fb1, // Bubblegum Pink
  sec4Trim: 0xff6b96,
  sec5: 0x8bc6ff, // Sky Periwinkle
  sec5Trim: 0x62aaff,
  sec5Catch: 0xc2e2ff,
  sec6: 0xc59bff, // Pastel Lavender
  sec6Trim: 0xa674f5,
  sec7: 0x72e0b4, // Seafoam Mint
  sec7Trim: 0x4cc797,
  sec7DiscA: 0xffa6d6,
  sec7DiscB: 0xfff3a8,
  sec8: 0xffa8c5, // Cotton Candy Rose
  sec8Trim: 0xff7da8,
  sec9: 0xffd27d, // Warm Honey
  sec9Trim: 0xf7b955,
  seesaw: 0xb794ff,
  seesawTrim: 0x9268eb,
  sec10: 0xff80a4, // Coral Berry
  sec10Trim: 0xf25c86,
  sec11: 0xffe28a, // Royal Pastel Gold
  sec11Trim: 0xf5c842,
  bounceDrum: 0xff5e8a,
  bounceRing: 0xfff275,
  hazardBar: 0xff6b6b,
  hazardStripe: 0xffffff,
  crownGold: 0xffcf33,
  crownGemPink: 0xff4f9a,
  crownGemBlue: 0x3bc9ff,
  hoodBlue: 0x2b7fff,
  hoodBlueDark: 0x1c63d6,
};
