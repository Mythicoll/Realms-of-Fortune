// Realms of Fortune — game logic

const state = {
  balance: 5000,
  bets: {},
  chip: 25,
  spinning: false,
  biome: "vault",
  biomeRoundsLeft: 0,
  history: [],
  wheelRotation: 0,

  // biome-specific runtime data
  greenNumbers: [],       // forest — pay 50:1
  volcanoMeter: 0,        // volcano — red hits fill it
  volcanoThreshold: 0,    // volcano — hidden random burst point
  goldenNumber: null,     // golden — one per spin, pays 70:1
  frozenNumbers: [],    // frost — cannot land this spin

  forcedBonus: null,    // demo trigger active this spin
  auto: false           // auto-demo running
};

const CHIP_VALUES = [5, 25, 100, 500];

const SIM_PLAYERS = [
  { name: "Aria", avatar: "🧝" },
  { name: "Rook", avatar: "🧙" },
  { name: "Vex", avatar: "🦹" },
  { name: "Juno", avatar: "🧚" }
];

const $ = (id) => document.getElementById(id);
const el = {
  balance: $("balance"), totalBet: $("totalBet"),
  biomeIcon: $("biomeIcon"), biomeName: $("biomeName"),
  biomeDesc: $("biomeDesc"), biomeRounds: $("biomeRounds"),
  volcanoMeter: $("volcanoMeter"), volcanoFill: $("volcanoFill"),
  board: $("board"), chipTray: $("chipTray"), players: $("players"),
  wheel: $("wheel"), wheelNumbers: $("wheelNumbers"), ball: $("ball"),
  resultNumber: $("resultNumber"), history: $("history"), readout: $("readout"),
  spinBtn: $("spinBtn"), clearBtn: $("clearBtn"), autoBtn: $("autoBtn"),
  worldEvent: $("worldEvent"), weIcon: $("weIcon"),
  weTitle: $("weTitle"), weSub: $("weSub"), weRules: $("weRules"),
  bonusPop: $("bonusPop"), bonusPopIcon: $("bonusPopIcon"),
  bonusPopText: $("bonusPopText"),
  bonusOdds: $("bonusOdds"), screenFlash: $("screenFlash"),
  eruption: $("eruption"), lavaField: $("lavaField"), eruptionSub: $("eruptionSub")
};

// ---------- Setup ----------
function init() {
  buildWheel();
  buildWheelNumbers();
  buildChips();
  buildBoard();
  buildPlayers();
  applyBiome("vault", true);
  render();

  el.spinBtn.addEventListener("click", () => spin(null));
  el.clearBtn.addEventListener("click", clearBets);
  if (el.autoBtn) el.autoBtn.addEventListener("click", toggleAuto);
  document.querySelectorAll(".btn-trigger").forEach((b) => {
    b.addEventListener("click", () => spin(b.dataset.biome));
  });
}

function buildWheel() {
  const n = EUROPEAN_WHEEL.length;
  const seg = 360 / n;
  const stops = EUROPEAN_WHEEL.map((num, i) => {
    const c = colorOf(num);
    const col = c === "red" ? "#c0392b" : c === "green" ? "#1f8a4c" : "#1a1a1a";
    return `${col} ${i * seg}deg ${(i + 1) * seg}deg`;
  }).join(", ");
  el.wheel.style.background = `conic-gradient(${stops})`;
}

function buildWheelNumbers() {
  el.wheelNumbers.innerHTML = "";
  const n = EUROPEAN_WHEEL.length;
  const seg = 360 / n;
  const radius = 122;
  EUROPEAN_WHEEL.forEach((num, i) => {
    const angle = (i * seg + seg / 2) * (Math.PI / 180);
    const x = Math.sin(angle) * radius;
    const y = -Math.cos(angle) * radius;
    const label = document.createElement("span");
    label.className = "wheel-num";
    label.textContent = num;
    label.style.transform =
      `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${i * seg + seg / 2}deg)`;
    el.wheelNumbers.appendChild(label);
  });
}

function buildChips() {
  el.chipTray.innerHTML = "";
  CHIP_VALUES.forEach((v) => {
    const c = document.createElement("div");
    c.className = "chip" + (v === state.chip ? " active" : "");
    c.dataset.val = v;
    c.textContent = "$" + v;
    c.addEventListener("click", () => { state.chip = v; buildChips(); });
    el.chipTray.appendChild(c);
  });
}

function buildPlayers() {
  el.players.innerHTML = "";
  SIM_PLAYERS.forEach((p, i) => {
    const d = document.createElement("div");
    d.className = "player";
    d.id = "player-" + i;
    d.innerHTML = `<span class="player-avatar">${p.avatar}</span>
      <span class="player-name">${p.name}</span>
      <span class="player-chip">—</span>`;
    el.players.appendChild(d);
  });
}

function buildBoard() {
  el.board.innerHTML = "";

  const zero = cell(0, "0");
  zero.classList.add("green", "zero");
  zero.style.gridRow = "1 / span 3";
  zero.style.gridColumn = "1";
  el.board.appendChild(zero);

  const rows = [
    [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
    [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
    [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]
  ];
  rows.forEach((row, r) => {
    row.forEach((num, colIdx) => {
      const c = cell(num, String(num));
      c.classList.add(colorOf(num));
      c.style.gridRow = String(r + 1);
      c.style.gridColumn = String(colIdx + 2);
      el.board.appendChild(c);
    });
  });

  const outsides = [
    { key: "1-18", label: "1 to 18" },
    { key: "even", label: "EVEN" },
    { key: "red", label: "RED" },
    { key: "black", label: "BLACK" },
    { key: "odd", label: "ODD" },
    { key: "19-36", label: "19 to 36" }
  ];
  outsides.forEach((o, i) => {
    const c = document.createElement("div");
    c.className = "cell outside";
    c.dataset.key = o.key;
    c.textContent = o.label;
    c.style.gridRow = "4";
    c.style.gridColumn = `${2 + i * 2} / span 2`;
    c.addEventListener("click", () => placeBet(o.key));
    el.board.appendChild(c);
  });
}

function cell(num, label) {
  const c = document.createElement("div");
  c.className = "cell";
  c.dataset.key = String(num);
  c.dataset.num = String(num);
  c.textContent = label;
  c.addEventListener("click", () => placeBet(String(num)));
  return c;
}

// ---------- Betting ----------
function placeBet(key) {
  if (state.spinning) return;
  // Frozen numbers cannot be bet on this spin
  if (state.biome === "frost" && state.frozenNumbers.includes(Number(key))) {
    flashReadout("❄️ That number is frozen and cannot be played this spin.", "lose");
    return;
  }
  if (state.balance < state.chip) { flashReadout("Not enough balance for that chip.", "lose"); return; }
  state.bets[key] = (state.bets[key] || 0) + state.chip;
  state.balance -= state.chip;
  render();
}

function clearBets() {
  if (state.spinning) return;
  state.balance += totalBet();
  state.bets = {};
  render();
}

function totalBet() {
  return Object.values(state.bets).reduce((a, b) => a + b, 0);
}

// ---------- Spin ----------
function spin(forceBiome) {
  if (state.spinning) return;
  if (totalBet() === 0) { flashReadout("Place a bet to spin the realm.", "lose"); return; }

  state.spinning = true;
  setControls(false);
  state.forcedBonus = forceBiome || null;

  // Demo trigger into a NEW realm: play the full World Event ceremony first,
  // then apply the realm, then run the rigged spin.
  if (forceBiome && state.biome !== forceBiome) {
    triggerWorldEvent(forceBiome, () => runForcedSpin(forceBiome));
    return;
  }

  if (forceBiome) {
    runForcedSpin(forceBiome);
    return;
  }

  const result = drawResult();
  animateTo(result, () => settle(result));
}

// Executes a rigged spin once the target biome is already active
function runForcedSpin(forceBiome) {
  if (forceBiome === "volcano") {
    // For the demo, make this red hit the one that bursts:
    // set threshold to current meter + 1 so the forced red triggers it.
    state.volcanoThreshold = state.volcanoMeter + 1;
    updateVolcanoMeter();
  }
  const result = riggedResultFor(forceBiome);
  animateTo(result, () => settle(result));
}

// Normal random draw, honoring frozen numbers (they cannot land)
function drawResult() {
  let pool = EUROPEAN_WHEEL;
  if (state.biome === "frost" && state.frozenNumbers.length) {
    pool = EUROPEAN_WHEEL.filter((n) => !state.frozenNumbers.includes(n));
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function riggedResultFor(biomeId) {
  switch (biomeId) {
    case "forest":
      return state.greenNumbers[Math.floor(Math.random() * state.greenNumbers.length)];
    case "golden":
      return state.goldenNumber;
    case "frost":
      // frost has no bonus number; just draw a valid (non-frozen) result
      return drawResult();
    case "volcano": {
      const reds = [...RED_NUMBERS];
      const betReds = reds.filter((n) => state.bets[String(n)]);
      if (betReds.length) return betReds[Math.floor(Math.random() * betReds.length)];
      return reds[Math.floor(Math.random() * reds.length)];
    }
    default:
      return drawResult();
  }
}

function animateTo(result, done) {
  const idx = EUROPEAN_WHEEL.indexOf(result);
  const seg = 360 / EUROPEAN_WHEEL.length;
  const alignTo = 360 - idx * seg - seg / 2;
  const currentMod = ((state.wheelRotation % 360) + 360) % 360;
  const delta = ((alignTo - currentMod) % 360 + 360) % 360;
  state.wheelRotation += 5 * 360 + delta;

  el.ball.style.opacity = "1";
  el.wheel.style.transform = `rotate(${state.wheelRotation}deg)`;
  el.wheelNumbers.style.transform = `rotate(${state.wheelRotation}deg)`;

  setTimeout(() => {
    el.resultNumber.textContent = result;
    done();
  }, 4600);
}

// ---------- Settle ----------
function settle(result) {
  let payout = 0;
  const winningKeys = [];
  let bonusMsg = "";
  let bonusKind = null;

  for (const [key, amount] of Object.entries(state.bets)) {
    const mult = evaluateBet(key, result);
    if (mult > 0) {
      let win = amount * mult;
      winningKeys.push(key);
      if (key === String(result)) {
        const b = applyBiomeBonus(result, amount);
        if (b.extra > 0) { win = b.total; bonusMsg = b.msg; bonusKind = b.kind; }
      }
      payout += win;
    }
  }

  // Volcano meter (independent of your bet)
  if (state.biome === "volcano") {
    handleVolcano(result, (msg, extra) => {
      payout += extra;
      if (extra > 0) { bonusMsg = msg; bonusKind = "volcano"; }
    });
  }

  state.balance += payout;
  state.history.unshift(result);
  if (state.history.length > 12) state.history.pop();

  updatePlayers(result);
  showResult(result, payout, bonusMsg);
  if (bonusKind) showBonusPop(bonusKind, bonusMsg);
  flashWinningCells(winningKeys);
  render();

  const delay = bonusKind ? 2400 : 1300;
  setTimeout(() => postSettle(result), delay);
}

// Standard payout multiples (incl. stake). Fixed odds.
function evaluateBet(key, result) {
  if (key === String(result)) return STRAIGHT_UP; // 35:1
  if (result === 0) return 0;
  const n = result;
  switch (key) {
    case "red": return colorOf(n) === "red" ? 2 : 0;
    case "black": return colorOf(n) === "black" ? 2 : 0;
    case "even": return n % 2 === 0 ? 2 : 0;
    case "odd": return n % 2 === 1 ? 2 : 0;
    case "1-18": return n >= 1 && n <= 18 ? 2 : 0;
    case "19-36": return n >= 19 && n <= 36 ? 2 : 0;
    default: return 0;
  }
}

// Fixed biome bonus on a straight-up hit. Returns {total, extra, msg, kind}
function applyBiomeBonus(result, stake) {
  const base = stake * STRAIGHT_UP;
  if (state.biome === "forest" && state.greenNumbers.includes(result)) {
    const total = stake * (PAYOUTS.forest + 1);
    return { total, extra: total - base, msg: `Verdant bounty! ${PAYOUTS.forest} : 1`, kind: "forest" };
  }
  if (state.biome === "golden" && result === state.goldenNumber) {
    const total = stake * (PAYOUTS.golden + 1);
    return { total, extra: total - base, msg: `Golden number! ${PAYOUTS.golden} : 1`, kind: "golden" };
  }
  return { total: base, extra: 0, msg: "", kind: null };
}

// Volcano: red hits fill meter; bursts at a hidden RANDOM threshold, pays 100:1
function handleVolcano(result, award) {
  if (colorOf(result) === "red") {
    state.volcanoMeter += 1;
    if (state.volcanoMeter >= state.volcanoThreshold) {
      const stakeOnResult = state.bets[String(result)] || 0;
      let subMsg;
      if (stakeOnResult > 0) {
        const base = stakeOnResult * STRAIGHT_UP;
        const total = stakeOnResult * (PAYOUTS.volcano + 1);
        award(`ERUPTION! ${result} blasts ${PAYOUTS.volcano} : 1`, total - base);
        subMsg = `${result} erupts for $${total} — 100 : 1!`;
      } else {
        flashReadout(`🌋 The volcano erupted on ${result}! (no bet placed there)`, "lose");
        subMsg = `${result} erupts! (no bet was placed there)`;
      }
      playEruption(subMsg);
      el.volcanoMeter.classList.add("burst");
      setTimeout(() => el.volcanoMeter.classList.remove("burst"), 900);
      // visibly drain the meter, then reset with a fresh, unknown threshold
      state.volcanoMeter = 0;
      rollVolcanoThreshold();
    }
  }
  updateVolcanoMeter();
}

// Pick a new hidden burst threshold in [minBurst, maxBurst]
function rollVolcanoThreshold() {
  const { minBurst, maxBurst } = BIOMES.volcano;
  state.volcanoThreshold = minBurst + Math.floor(Math.random() * (maxBurst - minBurst + 1));
}

// Full eruption animation: screen flash, shake, lava/ember burst, big callout
function playEruption(subMsg) {
  screenFlash();

  // spawn a burst of ember/lava particles
  el.lavaField.innerHTML = "";
  const COUNT = 40;
  for (let i = 0; i < COUNT; i++) {
    const p = document.createElement("span");
    p.className = "ember";
    const x = 50 + (Math.random() * 60 - 30);      // start near center-bottom
    const dx = (Math.random() * 2 - 1) * 60;         // horizontal drift (vw)
    const dur = 0.9 + Math.random() * 0.8;
    const size = 6 + Math.random() * 12;
    p.style.left = x + "vw";
    p.style.width = p.style.height = size + "px";
    p.style.setProperty("--dx", dx + "vw");
    p.style.animationDuration = dur + "s";
    p.style.background = Math.random() < 0.5 ? "#ff6b1a" : "#ffd23f";
    el.lavaField.appendChild(p);
  }

  el.eruptionSub.textContent = subMsg;
  el.eruption.classList.add("show");
  setTimeout(() => el.eruption.classList.remove("show"), 2400);
}

// ---------- Post-settle biome flow ----------
function postSettle(result) {
  state.forcedBonus = null;

  if (state.biome === "vault") {
    if (Math.random() < BIOMES.vault.shiftChance) {
      triggerWorldEvent(pickRandomBiome());
      return;
    }
  } else {
    state.biomeRoundsLeft -= 1;

    if (state.biome === "golden" && state.biomeRoundsLeft > 0) pickGoldenNumber();
    if (state.biome === "frost" && state.biomeRoundsLeft > 0) refreezeNumbers();

    if (state.biomeRoundsLeft <= 0) {
      triggerWorldEvent("vault");
      return;
    }
  }
  endSpin();
}

// Rules text shown on the World Event card for each realm
const WE_RULES = {
  forest: "🌲 Green numbers now pay <b>50 : 1</b>",
  volcano: "🌋 Red hits charge the volcano — burst number pays <b>100 : 1</b>",
  golden: "👑 One gold number each spin pays <b>70 : 1</b>",
  frost: "❄️ Two numbers freeze out each spin — they cannot land",
  vault: "🏦 Back to standard play — the realm goes dormant"
};

// Gamified World Event ceremony. Optional onDone callback runs after the
// realm is applied (used by demo triggers to then run the rigged spin).
function triggerWorldEvent(nextId, onDone) {
  const b = BIOMES[nextId];

  // 1) screen flash + shake to signal the shift is coming
  screenFlash();

  el.weIcon.textContent = b.icon;
  el.weTitle.textContent = b.name;
  el.weSub.textContent = b.subtitle;
  el.weRules.innerHTML = WE_RULES[nextId] || "";
  el.worldEvent.dataset.kind = nextId;
  el.worldEvent.classList.add("show");

  // 2) mid-ceremony: apply the realm so the board/theme updates behind the card
  setTimeout(() => applyBiome(nextId), 2000);

  // 3) hold on the rules long enough to read, then close and continue
  setTimeout(() => {
    el.worldEvent.classList.remove("show");
    if (typeof onDone === "function") onDone();
    else endSpin();
  }, 4100);
}

// Quick full-screen flash + table shake
function screenFlash() {
  const f = el.screenFlash;
  if (f) {
    f.classList.remove("go");
    void f.offsetWidth; // restart animation
    f.classList.add("go");
  }
  document.querySelector(".app").classList.add("quake");
  setTimeout(() => document.querySelector(".app").classList.remove("quake"), 700);
}

// ---------- Apply biome ----------
function applyBiome(id, silent) {
  state.biome = id;
  const b = BIOMES[id];
  document.body.dataset.biome = id;
  el.biomeIcon.textContent = b.icon;
  el.biomeName.textContent = b.name;
  el.biomeDesc.textContent = b.desc;

  state.greenNumbers = [];
  state.goldenNumber = null;
  state.frozenNumbers = [];
  el.volcanoMeter.hidden = true;

  if (id === "vault") {
    state.biomeRoundsLeft = 0;
    el.biomeRounds.textContent = "";
  } else {
    state.biomeRoundsLeft = b.duration;
    el.biomeRounds.textContent = `${state.biomeRoundsLeft} spins`;

    if (id === "forest") state.greenNumbers = pickRandomNumbers(b.greenCount);
    else if (id === "golden") pickGoldenNumber();
    else if (id === "frost") refreezeNumbers();
    else if (id === "volcano") {
      state.volcanoMeter = 0;
      rollVolcanoThreshold();     // hidden random burst point
      el.volcanoMeter.hidden = false;
      updateVolcanoMeter();
    }
  }
  updateBonusOdds();
  markSpecialCells();
}

function pickGoldenNumber() {
  state.goldenNumber = 1 + Math.floor(Math.random() * 36);
  markSpecialCells();
}

// Frost: freeze new numbers, refund any bets that were on them
function refreezeNumbers() {
  state.frozenNumbers = pickRandomNumbers(BIOMES.frost.frozenCount);
  state.frozenNumbers.forEach((n) => {
    const k = String(n);
    if (state.bets[k]) { state.balance += state.bets[k]; delete state.bets[k]; }
  });
  markSpecialCells();
}

function updateVolcanoMeter() {
  // Show pressure building against the MAX possible threshold so the exact
  // burst point stays hidden. It always looks like it could blow soon.
  const pct = Math.min(100, (state.volcanoMeter / BIOMES.volcano.maxBurst) * 100);
  el.volcanoFill.style.width = pct + "%";
  // meter label hints at rising danger
  const danger = state.volcanoMeter >= BIOMES.volcano.minBurst;
  el.volcanoMeter.classList.toggle("danger", danger);
}

// Update the dynamic "Active Realm Bonus" line in the right rules panel
function updateBonusOdds() {
  if (!el.bonusOdds) return;
  const map = {
    vault: "No realm active — standard payouts only.",
    forest: `🌲 Green numbers pay <b>${PAYOUTS.forest} : 1</b>`,
    volcano: `🌋 Volcano burst pays <b>${PAYOUTS.volcano} : 1</b>`,
    golden: `👑 Gold number pays <b>${PAYOUTS.golden} : 1</b>`,
    frost: `❄️ 2 numbers frozen out — <b>no bonus payout</b>`
  };
  el.bonusOdds.innerHTML = map[state.biome] || map.vault;
}

function markSpecialCells() {
  document.querySelectorAll(".cell").forEach((c) => {
    c.classList.remove("mark-green", "mark-gold", "mark-frost");
  });
  const mark = (nums, cls) => nums.forEach((n) => {
    const c = document.querySelector(`.cell[data-num="${n}"]`);
    if (c) c.classList.add(cls);
  });
  if (state.biome === "forest") mark(state.greenNumbers, "mark-green");
  if (state.biome === "golden" && state.goldenNumber) mark([state.goldenNumber], "mark-gold");
  if (state.biome === "frost") mark(state.frozenNumbers, "mark-frost");
}

function endSpin() {
  state.bets = {};
  state.spinning = false;
  setControls(true);
  if (state.biome !== "vault") el.biomeRounds.textContent = `${state.biomeRoundsLeft} spins`;
  render();
  if (state.auto) setTimeout(autoStep, 900);
}

function setControls(enabled) {
  el.spinBtn.disabled = !enabled;
  el.clearBtn.disabled = !enabled;
  document.querySelectorAll(".btn-trigger").forEach((b) => (b.disabled = !enabled));
}

// ---------- Auto-demo mode ----------
// Runs a hands-free loop: place spread bets, cycle through each biome trigger,
// then a couple of normal spins, repeating.
const AUTO_SEQUENCE = ["forest", "volcano", "golden", "frost", null, null];
let autoIdx = 0;

function toggleAuto() {
  state.auto = !state.auto;
  el.autoBtn.textContent = state.auto ? "■ Stop Auto-Demo" : "▶ Auto-Demo";
  el.autoBtn.classList.toggle("running", state.auto);
  if (state.auto) autoStep();
}

function autoStep() {
  if (!state.auto || state.spinning) return;
  // spread a modest bet across several numbers + red so bonuses can land
  autoPlaceBets();
  const next = AUTO_SEQUENCE[autoIdx % AUTO_SEQUENCE.length];
  autoIdx++;
  setTimeout(() => spin(next), 500);
}

function autoPlaceBets() {
  clearBets();
  state.chip = 25;
  // cover a handful of straight-ups + red so demo bonuses pay
  const picks = new Set([...RED_NUMBERS].slice(0, 6));
  // also cover the active biome's special numbers so they hit visibly
  state.greenNumbers.forEach((n) => picks.add(n));
  if (state.goldenNumber) picks.add(state.goldenNumber);
  picks.forEach((n) => {
    if (!(state.biome === "frost" && state.frozenNumbers.includes(n))) {
      if (state.balance >= state.chip) {
        state.bets[String(n)] = (state.bets[String(n)] || 0) + state.chip;
        state.balance -= state.chip;
      }
    }
  });
  // outside red bet for volcano meter action
  if (state.balance >= state.chip) {
    state.bets["red"] = (state.bets["red"] || 0) + state.chip;
    state.balance -= state.chip;
  }
  // top up balance if the demo runs low, so it never stalls
  if (state.balance < 500) state.balance = 5000;
  render();
}

// ---------- Players ----------
function updatePlayers(result) {
  SIM_PLAYERS.forEach((p, i) => {
    const node = $("player-" + i);
    const chip = node.querySelector(".player-chip");
    node.classList.remove("win");
    if (Math.random() < 0.42) {
      const amt = [50, 100, 250, 500][Math.floor(Math.random() * 4)];
      chip.textContent = "+$" + amt;
      node.classList.add("win");
    } else {
      chip.textContent = "—";
    }
  });
}

// ---------- Result + bonus popup ----------
function showResult(result, payout, bonusMsg) {
  const c = colorOf(result);
  if (payout > 0) {
    el.readout.className = "readout win";
    el.readout.innerHTML = bonusMsg
      ? `<span class="big">${result}</span> · ${bonusMsg} · You won <span class="big">$${payout}</span>`
      : `Landed on <span class="big">${result}</span> (${c}). You won <span class="big">$${payout}</span>`;
  } else {
    el.readout.className = "readout lose";
    el.readout.innerHTML = `Landed on <span class="big">${result}</span> (${c}). No win this round.`;
  }
}

const BONUS_ICON = { forest: "🌲", volcano: "🌋", golden: "👑", frost: "❄️" };

function showBonusPop(kind, msg) {
  el.bonusPop.dataset.kind = kind;
  el.bonusPopIcon.textContent = BONUS_ICON[kind] || "✦";
  el.bonusPopText.innerHTML = `<span class="pop-hit">${msg}</span><span class="pop-hype">${BIOME_HYPE[kind] || ""}</span>`;
  el.bonusPop.classList.add("show");
  setTimeout(() => el.bonusPop.classList.remove("show"), 2100);
}

// ---------- Render ----------
function render() {
  el.balance.textContent = state.balance;
  el.totalBet.textContent = totalBet();

  document.querySelectorAll(".cell").forEach((c) => {
    const old = c.querySelector(".bet-marker");
    if (old) old.remove();
    const key = c.dataset.key;
    if (key && state.bets[key]) {
      const m = document.createElement("span");
      m.className = "bet-marker";
      m.textContent = state.bets[key] >= 1000 ? "1k+" : state.bets[key];
      c.appendChild(m);
    }
  });

  el.history.innerHTML = "";
  state.history.forEach((n) => {
    const h = document.createElement("div");
    h.className = "hist-chip " + colorOf(n);
    h.textContent = n;
    el.history.appendChild(h);
  });
}

function flashWinningCells(keys) {
  keys.forEach((k) => {
    const c = document.querySelector(`.cell[data-key="${k}"]`);
    if (c) { c.classList.add("win-flash"); setTimeout(() => c.classList.remove("win-flash"), 2000); }
  });
}

function flashReadout(msg, cls) {
  el.readout.className = "readout " + (cls || "");
  el.readout.textContent = msg;
}

document.addEventListener("DOMContentLoaded", init);
