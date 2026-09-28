// Realms of Fortune — biome definitions & wheel data
// NOTE: In a real-money product the base odds would be tuned so the house edge
// stays fixed regardless of biome bonuses. POC multipliers are illustrative.

const EUROPEAN_WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36
]);

function colorOf(n) {
  if (n === 0) return "green";
  return RED_NUMBERS.has(n) ? "red" : "black";
}

// Base straight-up payout multiple (including stake): 35:1 -> 36x returned
const STRAIGHT_UP = 36;

// Fixed bonus payouts (X:1, total returned = stake * (X + 1)).
// Fixed so a single hit can never bankrupt the house — no runaway multipliers.
const PAYOUTS = {
  forest: 50,   // green number
  golden: 70,   // gold number
  volcano: 100  // volcano burst number (the rare big moment)
  // frost has no special payout — its twist is freezing numbers out
};

// Punchy one-liners announced when a realm activates / bonus hits
const BIOME_HYPE = {
  forest: "Hit the Green — Nature Pays 50 : 1!",
  volcano: "Aim for Red for an Explosion — Burst pays 100 : 1!",
  golden: "Chase the Gold — One number, 70 : 1!",
  frost: "Two numbers freeze out — the wheel tightens in your favor!"
};

const BIOMES = {
  // Base neutral realm — standard greys & blacks, no bonus
  vault: {
    id: "vault",
    name: "The Vault",
    icon: "🏦",
    desc: "Standard play. The realm is dormant... for now.",
    subtitle: "Standard roulette. Every spin risks awakening a realm.",
    // low natural chance to awaken a realm on a normal spin
    shiftChance: 0.15
  },

  // 1) Verdant Forest — random numbers turn green; hitting one pays a fixed 50:1
  forest: {
    id: "forest",
    name: "Verdant Forest",
    icon: "🌲",
    desc: "Marked green numbers pay a fixed 50 : 1. Find them before they fade.",
    subtitle: "The forest blesses the lucky. Green numbers pay 50 : 1.",
    greenCount: 6,        // how many random numbers turn green
    duration: 5
  },

  // 2) Volcanic Ridge — red hits fill a meter; burst threshold is RANDOM & hidden
  volcano: {
    id: "volcano",
    name: "Volcanic Ridge",
    icon: "🌋",
    desc: "Every RED hit feeds the volcano. It bursts when it will — that number pays 100 : 1.",
    subtitle: "The mountain stirs. Feed it red... no one knows when it blows.",
    minBurst: 3,          // fewest red hits that can trigger a burst
    maxBurst: 7,          // most red hits before it must burst
    duration: 8
  },

  // 3) Golden Hall — one gold number per spin; hitting it pays a fixed 70:1
  golden: {
    id: "golden",
    name: "Golden Hall",
    icon: "👑",
    desc: "A single gold number each spin. Hit it and collect 70 : 1.",
    subtitle: "The hall gleams. One golden number, 70 : 1.",
    duration: 5
  },

  // 4) Frost Field — 2 random numbers freeze each spin and CANNOT hit,
  // narrowing the wheel. Looks player-friendly; house edge holds.
  frost: {
    id: "frost",
    name: "Frost Field",
    icon: "❄️",
    desc: "Each spin, 2 numbers freeze solid and cannot land. The odds tighten in your favor.",
    subtitle: "The field freezes over. Two numbers turn to ice and cannot fall.",
    frozenCount: 2,       // numbers frozen out each spin
    duration: 8
  }
};

const SPECIAL_BIOMES = ["forest", "volcano", "golden", "frost"];

function pickRandomBiome() {
  return SPECIAL_BIOMES[Math.floor(Math.random() * SPECIAL_BIOMES.length)];
}

// Pick n unique random numbers from 1..36
function pickRandomNumbers(n) {
  const pool = [];
  for (let i = 1; i <= 36; i++) pool.push(i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

// (Frost Field uses pickRandomNumbers to choose which numbers freeze out.)
