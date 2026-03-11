async function processRows() {
  const settings = await chrome.storage.sync.get(null) || {};

  await processData(`.table-row[data-row-id], .player-list__item, #body-player, .panel-body .well`, getSkillsApi, settings); // API Fetch

  await processData(`.table-row.is-hovered.has-border`, getSkillsDom, settings); // DOM Fetch
}

async function processData(selector, skillsSource, settings) {
  const elements = document.querySelectorAll(selector);

  for (const el of elements) {
    // Prevent double‑processing the same row
    if (el.dataset.sumskillAdded) continue;
    el.dataset.sumskillAdded = true;

    let match;

    const pid = el.querySelector('a[href*="player/PID/"]');
    const element = document.querySelector(".ea");

    if (element && pid) {
      match = pid?.href.match(/\b\w+\b/g)
      addContainer();
    } else if (pid) {
      match = pid?.href.match(/\b\w+\b/g)
    }

    let source;

    if (match) {
      const idMatch = match[match.length - 1];
      source = idMatch;
    } else {
      source = el;
    }


    const skills = await calculateValue(source, skillsSource);

    // Render badges based on user settings
    loadSettings(el, skills, settings);
  }
}

function loadSettings(el, skills, settings) {
  // Where badges should be inserted depending on page context
  if (skills === undefined) return;

  const selectors = {
    training: `.table__cell--effectiveness + .table__cell--action`,
    transfer: `.table__cell--stop, .table__cell--endDate + .table__cell--action`,
    individual: `.table__cell--eff`,
    squad: `.table__cell--copy, .player-box-header`,
    player: `.badge-container`,
    transferSearch: `#playerCell`,
  };

  const skillLabels = {
    sumskill: "Sumskill",
    adjustedSumskill: "Adjusted Sumskill",
    midSumskill: "MID Sumskill",
    adjustedMidSumskill: "Adjusted MID Sumskill",
    defSumskill: "DEF Sumskill",
    attSumskill: "ATT Sumskill",
    keeperSumskill: "GK Sumskill",
    talentSenior: "Talent",
    talentSeniorYS: "Talent (trained from YS)"
  };

  // Loop through all skill types and all page contexts
  for (const prefixKey of Object.keys(skillLabels)) {
    for (const selector of Object.keys(selectors)) {
      const storageKey = `${prefixKey}-${selector}`;

      // Only add badge if user enabled it in settings
      if (settings[storageKey]) {
        addBadge(
          el,
          skills[prefixKey],
          prefixKey,
          skillLabels[prefixKey],
          selectors[selector]
        );
      }
    }
  }
}

// Fetches player data from the API
async function fetchPlayer(id) {
  if (id instanceof HTMLElement) return;

  const res = await fetch(`https://sokker.org/api/player/${id}`);
  return res.json();
}

// Computes all skill aggregates and weighted metrics
async function calculateValue(source, fetchSkills) {
  const s = await fetchSkills(source);

  if (!s) return;

  const sumskill = s.stamina + s.keeper + s.pace + s.defending + s.technique + s.playmaking + s.passing + s.striker;
  const midSumskill = s.pace + s.defending + s.technique + s.playmaking + s.passing;
  const adjustedMidSumskill = Number((s.pace * 1.51 + s.defending * 1.23 + s.technique * 1.13 + s.playmaking + s.passing) * 0.851).toFixed(1);
  const defSumskill = s.pace + s.defending;
  const attSumskill = s.pace + s.technique + s.striker;
  const adjustedSumskill = Number(
    (s.stamina + s.keeper + s.pace * 1.51 + s.defending * 1.23 + s.technique * 1.13 + s.playmaking + s.passing + s.striker * 1.23) * 0.865).toFixed(1);

  const keeperSumskill = s.keeper + s.pace + s.passing;

  const talentSenior = await calculateMinMaxS(source);
  const talentSeniorYS = await calculateMinMaxJ(source);

  return {
    sumskill,
    adjustedSumskill,
    midSumskill,
    adjustedMidSumskill,
    attSumskill,
    defSumskill,
    keeperSumskill,
    talentSenior,
    talentSeniorYS
  };
}

// Extracts skills directly from DOM table cells
function getSkillsDom(row) {
  const stamina = Number(row.querySelector(".table__cell--stamina .growth-bg").textContent);
  const pace = Number(row.querySelector(".table__cell--pace .growth-bg").textContent);
  const technique = Number(row.querySelector(".table__cell--technique .growth-bg").textContent);
  const passing = Number(row.querySelector(".table__cell--passing .growth-bg").textContent);
  const keeper = Number(row.querySelector(".table__cell--keeper .growth-bg").textContent);
  const defending = Number(row.querySelector(".table__cell--defending .growth-bg").textContent);
  const playmaking = Number(row.querySelector(".table__cell--playmaking .growth-bg").textContent);
  const striker = Number(row.querySelector(".table__cell--striker .growth-bg").textContent);

  return { stamina, pace, technique, passing, keeper, defending, playmaking, striker };
}

// Extracts skills from API response
async function getSkillsApi(id) {
  if (id instanceof HTMLElement) return;

  const player = await fetchPlayer(id);

  const { stamina, pace, technique, passing, keeper, defending, playmaking, striker } = player.info.skills;
  return { stamina, pace, technique, passing, keeper, defending, playmaking, striker };
}

// Renders a badge inside the appropriate cell
function addBadge(row, value, className, tooltipText, target) {
  const container = row.querySelector(target);
  if (!container) return; // Skip if target cell doesn't exist

  const div = document.createElement("div");
  div.textContent = value;
  div.classList.add("badge", className);
  div.title = tooltipText;

  container.appendChild(div);
}

// MutationObserver + debouncer to reprocess rows when DOM updates
const observer = new MutationObserver(() => {
  clearTimeout(window._sumskillTimer);
  window._sumskillTimer = setTimeout(processRows, 0); // Debounce to avoid spam // OFF for now
});

observer.observe(document.body, { childList: true, subtree: true });

function addContainer() {
  const sumskillContainer = document.querySelector(".panel-default + .panel-default");
  const sumskill = document.createElement("div");
  const badgeContainer = document.createElement("div");

  sumskill.textContent = "Sumskill";
  sumskill.classList.add("sumskill");
  badgeContainer.classList.add("badge-container");

  sumskillContainer.appendChild(sumskill);
  sumskillContainer.appendChild(badgeContainer);
}

async function fetchPlayerTraining(id) {
  const url = `https://sokker.org/api/training/${id}/report`;
  const response = await fetch(url);
  return response.json();
}

async function transformIntoArray(id) {
  const trainingJSON = await fetchPlayerTraining(id);

  const trainingArray = [];

  for (let index = trainingJSON.reports.length - 1; index >= 0; index--) {
    const element = trainingJSON.reports[index];

    const { defending: DEF, keeper: GK, pace: PAC, passing: PAS, technique: TEC, playmaking: PM, stamina: STA, striker: STR } = element.skills,
      { code: KIND } = element.kind,
      { age } = element,
      { code: TR } = element.type,
      { intensity: EFF } = element,
      { code: GKtrue } = element.formation

    trainingArray.push({ age, DEF, GK, PAC, PAS, TEC, PM, STA, STR, TR, EFF, KIND, GKtrue });
  }
  return trainingArray;
}

async function calculateMinMaxJ(id) {
  const playerArray = await transformIntoArray(id);

  // Defensive guard: no training data
  if (!Array.isArray(playerArray) || playerArray.length === 0) {
    console.warn("No training data available for this player.");
    return "0.0/0.0";
  }

  const training = calculateTrainingValuesJ(playerArray);

  // Defensive guard: malformed training object
  if (!training) {
    console.warn("Training calculation failed.");
    return "0.0/0.0";
  }

  const techDefMod = 0.1541;
  const passPmGkMod = 0.1686;
  const pacMod = 0.1267;
  const strMod = 0.1411;
  const gtMod = 6.666667;

  const resultMINtec = training.TEC.valueAtLevel0Min;
  const resultMAXtec = training.TEC.valueAtLevel0Max;
  const resultMINdef = training.DEF.valueAtLevel0Min;
  const resultMAXdef = training.DEF.valueAtLevel0Max;
  const resultMINpas = training.PAS.valueAtLevel0Min;
  const resultMAXpas = training.PAS.valueAtLevel0Max;
  const resultMINpm = training.PM.valueAtLevel0Min;
  const resultMAXpm = training.PM.valueAtLevel0Max;
  const resultMINpac = training.PAC.valueAtLevel0Min;
  const resultMAXpac = training.PAC.valueAtLevel0Max;
  const resultMINstr = training.STR.valueAtLevel0Min;
  const resultMAXstr = training.STR.valueAtLevel0Max;
  const resultMINgk = training.GK.valueAtLevel0Min;
  const resultMAXgk = training.GK.valueAtLevel0Max;

  const talentTecMin = techDefMod / (resultMINtec / gtMod) * 3;
  const talentTecMax = techDefMod / (resultMAXtec / gtMod) * 3;
  const talentDefMin = techDefMod / (resultMINdef / gtMod) * 3;
  const talentDefMax = techDefMod / (resultMAXdef / gtMod) * 3;
  const talentPassMin = passPmGkMod / (resultMINpas / gtMod) * 3;
  const talentPassMax = passPmGkMod / (resultMAXpas / gtMod) * 3;
  const talentPmMin = passPmGkMod / (resultMINpm / gtMod) * 3;
  const talentPmMax = passPmGkMod / (resultMAXpm / gtMod) * 3;
  const talentPacMin = pacMod / (resultMINpac / gtMod) * 3;
  const talentPacMax = pacMod / (resultMAXpac / gtMod) * 3;
  const talentStrMin = strMod / (resultMINstr / gtMod) * 3;
  const talentStrMax = strMod / (resultMAXstr / gtMod) * 3;
  const talentGkMin = passPmGkMod / (resultMINgk / gtMod) * 3;
  const talentGkMax = passPmGkMod / (resultMAXgk / gtMod) * 3;

/*   console.log(`${talentDefMax} - ${talentDefMin}`)
  console.log(`${talentGkMax} - ${talentGkMin}`)
  console.log(`${talentPacMax} - ${talentPacMin}`)
  console.log(`${talentPassMax} - ${talentPassMin}`)
  console.log(`${talentPmMax} - ${talentPmMin}`)
  console.log(`${talentStrMax} - ${talentStrMin}`)
  console.log(`${talentTecMax} - ${talentTecMin}`) */

  function minMaxCheck() {
    let talentMax = 0;
    let talentMin = 7;

    function checkMAX() {
      if (talentMax < talentTecMax) {
        talentMax = talentTecMax;
      }
      if (talentMax < talentDefMax) {
        talentMax = talentDefMax;
      }
      if (talentMax < talentPassMax) {
        talentMax = talentPassMax;
      }
      if (talentMax < talentPmMax) {
        talentMax = talentPmMax;
      }
      if (talentMax < talentPacMax) {
        talentMax = talentPacMax;
      }
      if (talentMax < talentStrMax) {
        talentMax = talentStrMax;
      }
      if (talentMax < talentGkMax) {
        talentMax = talentGkMax;
      }
      return talentMax;
    }

    function checkMIN() {
      if (talentMin > talentTecMin) {
        talentMin = talentTecMin;
      }
      if (talentMin > talentDefMin) {
        talentMin = talentDefMin;
      }
      if (talentMin > talentPassMin) {
        talentMin = talentPassMin;
      }
      if (talentMin > talentPmMin) {
        talentMin = talentPmMin;
      }
      if (talentMin > talentPacMin) {
        talentMin = talentPacMin;
      }
      if (talentMin > talentStrMin) {
        talentMin = talentStrMin;
      }
      if (talentMin > talentGkMin) {
        talentMin = talentGkMin;
      }
      return talentMin;
    }
    return { checkMAX, checkMIN };
  };

  const min = minMaxCheck().checkMIN();
  const max = minMaxCheck().checkMAX();

  return (`${max.toFixed(2)}-${min.toFixed(2)}`);
};


async function calculateMinMaxS(id) {
  const playerArray = await transformIntoArray(id);

  // Defensive guard: no training data
  if (!Array.isArray(playerArray) || playerArray.length === 0) {
    console.warn("No training data available for this player.");
    return "0.0/0.0"; // or null, or throw — your choice
  }

  const training = calculateTrainingValuesS(playerArray);

  // Defensive guard: malformed training object
  if (!training) {
    console.warn("Training calculation failed.");
    return "0.0/0.0";
  }

  const techDefMod = 0.1541;
  const passPmGkMod = 0.1686;
  const pacMod = 0.1267;
  const strMod = 0.1411;
  const gtMod = 6.666667;

  const resultMINtec = training.TEC.valueAtLevel0Min;
  const resultMAXtec = training.TEC.valueAtLevel0Max;
  const resultMINdef = training.DEF.valueAtLevel0Min;
  const resultMAXdef = training.DEF.valueAtLevel0Max;
  const resultMINpas = training.PAS.valueAtLevel0Min;
  const resultMAXpas = training.PAS.valueAtLevel0Max;
  const resultMINpm = training.PM.valueAtLevel0Min;
  const resultMAXpm = training.PM.valueAtLevel0Max;
  const resultMINpac = training.PAC.valueAtLevel0Min;
  const resultMAXpac = training.PAC.valueAtLevel0Max;
  const resultMINstr = training.STR.valueAtLevel0Min;
  const resultMAXstr = training.STR.valueAtLevel0Max;
  const resultMINgk = training.GK.valueAtLevel0Min;
  const resultMAXgk = training.GK.valueAtLevel0Max;

  const talentTecMin = techDefMod / (resultMINtec / gtMod) * 3;
  const talentTecMax = techDefMod / (resultMAXtec / gtMod) * 3;
  const talentDefMin = techDefMod / (resultMINdef / gtMod) * 3;
  const talentDefMax = techDefMod / (resultMAXdef / gtMod) * 3;
  const talentPassMin = passPmGkMod / (resultMINpas / gtMod) * 3;
  const talentPassMax = passPmGkMod / (resultMAXpas / gtMod) * 3;
  const talentPmMin = passPmGkMod / (resultMINpm / gtMod) * 3;
  const talentPmMax = passPmGkMod / (resultMAXpm / gtMod) * 3;
  const talentPacMin = pacMod / (resultMINpac / gtMod) * 3;
  const talentPacMax = pacMod / (resultMAXpac / gtMod) * 3;
  const talentStrMin = strMod / (resultMINstr / gtMod) * 3;
  const talentStrMax = strMod / (resultMAXstr / gtMod) * 3;
  const talentGkMin = passPmGkMod / (resultMINgk / gtMod) * 3;
  const talentGkMax = passPmGkMod / (resultMAXgk / gtMod) * 3;

  /*   console.log(`${talentDefMax} - ${talentDefMin}`)
    console.log(`${talentGkMax} - ${talentGkMin}`)
    console.log(`${talentPacMax} - ${talentPacMin}`)
    console.log(`${talentPassMax} - ${talentPassMin}`)
    console.log(`${talentPmMax} - ${talentPmMin}`)
    console.log(`${talentStrMax} - ${talentStrMin}`)
    console.log(`${talentTecMax} - ${talentTecMin}`) */

  function minMaxCheck() {
    let talentMax = 0;
    let talentMin = 7;

    function checkMAX() {
      if (talentMax < talentTecMax) {
        talentMax = talentTecMax;
      }
      if (talentMax < talentDefMax) {
        talentMax = talentDefMax;
      }
      if (talentMax < talentPassMax) {
        talentMax = talentPassMax;
      }
      if (talentMax < talentPmMax) {
        talentMax = talentPmMax;
      }
      if (talentMax < talentPacMax) {
        talentMax = talentPacMax;
      }
      if (talentMax < talentStrMax) {
        talentMax = talentStrMax;
      }
      if (talentMax < talentGkMax) {
        talentMax = talentGkMax;
      }
      return talentMax;
    }

    function checkMIN() {
      if (talentMin > talentTecMin) {
        talentMin = talentTecMin;
      }
      if (talentMin > talentDefMin) {
        talentMin = talentDefMin;
      }
      if (talentMin > talentPassMin) {
        talentMin = talentPassMin;
      }
      if (talentMin > talentPmMin) {
        talentMin = talentPmMin;
      }
      if (talentMin > talentPacMin) {
        talentMin = talentPacMin;
      }
      if (talentMin > talentStrMin) {
        talentMin = talentStrMin;
      }
      if (talentMin > talentGkMin) {
        talentMin = talentGkMin;
      }
      return talentMin;
    }
    return { checkMAX, checkMIN };
  };
  const min = minMaxCheck().checkMIN();
  const max = minMaxCheck().checkMAX();

  return (`${max.toFixed(2)}-${min.toFixed(2)}`);
};

/* calculateMinMaxJ(39286054).then((min) => {
  console.log(min);
})
 */
/* calculateMinMaxS(1).then((min) => {
  console.log(min);
}) */

// Junior start

function calculateTrainingValuesJ(playerData) {
  const N = playerData.length;
  if (N < 2) return { error: "Need at least 2 snapshots" };

  const SKILLS = ['PAC', 'TEC', 'PAS', 'DEF', 'PM', 'STR', 'GK'];
  const DIRECT_MAP = { 8: 'PAC', 5: 'TEC', 6: 'DEF', 7: 'STR', 1: 'STA', 2: 'GK', 3: 'PM', 4: 'PAS' };
  const MAX_AT_0 = {
    'TEC': 1.05333333,
    'DEF': 1.05333333,
    'PAS': 1.13333333,
    'PM': 1.13333333,
    'PAC': 0.84666666,
    'STR': 0.9533333,
    'GK': 1.13333333
  };

  const AGE_CUMULATIVE = {
    16: 1.0,
    17: 0.9469,
    18: 0.888003,
    19: 0.825764,
    20: 0.760995,
    21: 0.694578,
    22: 0.628532,
    23: 0.563964,
    24: 0.501087,
    25: 0.440191,
    26: 0.381630,
    27: 0.325800,
    28: 0.335700,
    29: 0.285200,
    30: 0.240200
  };

  function getCumulative(age) {
    if (age <= 16) return 1.0;
    return AGE_CUMULATIVE[age] || AGE_CUMULATIVE[30];
  }

  const results = {};

  // Precompute age factors
  const ageFactor = new Array(N).fill(1.0);
  for (let t = 1; t < N; t++) {
    const prevAge = playerData[t - 1].age;
    const currAge = playerData[t].age;
    if (currAge > prevAge) {
      const prevCum = getCumulative(prevAge);
      const currCum = getCumulative(currAge);
      ageFactor[t] = currCum / prevCum;
    }
  }

  // Precompute eff, kind, TR, GKtrue
  const effArr = new Array(N);
  const kindArr = new Array(N);
  const trArr = new Array(N);
  const gkTrueArr = new Array(N);

  for (let t = 0; t < N; t++) {
    const row = playerData[t];
    effArr[t] = (row.EFF / 100) || 1.0;
    kindArr[t] = row.KIND || 1;
    trArr[t] = row.TR || 0;
    gkTrueArr[t] = row.GKtrue || 0;
  }

  for (let skill of SKILLS) {
    const maxAge = (skill === 'PAC') ? 28 : 30;

    // Determine maxT
    let maxT = N - 1;
    for (let i = N - 1; i >= 0; i--) {
      if (playerData[i].age > maxAge) maxT = i - 1;
      else break;
    }
    if (maxT < 1 || playerData[0].age > maxAge) {
      results[skill] = { error: `No valid data for ${skill} (age exceeds limit)` };
      continue;
    }

    const startAge = playerData[0].age;
    const preFactor = getCumulative(startAge);
    const startingN = playerData[0][skill];
    const maxTalent = MAX_AT_0[skill] || 2.0;
    const basePow = Math.pow(0.92, startingN);
    const HIGH = maxTalent * preFactor * basePow;
    const LOW = 0.3 * preFactor * basePow;

    // Per-week, per-skill arrays
    const multArr = new Array(N);
    const upArr = new Array(N);
    const forbiddenArr = new Array(N);

    for (let t = 1; t < N; t++) {
      const row = playerData[t];
      const prevRow = playerData[t - 1];

      const kind = kindArr[t];
      const tr = trArr[t];
      const direct = DIRECT_MAP[tr] || null;

      upArr[t] = (row[skill] === prevRow[skill] + 1);

      if (kind === 3 || (skill === 'GK' && gkTrueArr[t] !== 0)) {
        forbiddenArr[t] = true;
        multArr[t] = 0.0;
      } else {
        forbiddenArr[t] = false;
        let mult = (skill === direct) ? 1.0 : 0.15;
        if (kind === 2 && skill === direct) mult = 0.24;
        multArr[t] = mult;
      }
    }

    // Compute possible f values
    const startingVisible = playerData[0][skill];
    let j_min = Math.ceil(startingVisible / 0.18);
    let j_max = Math.floor((startingVisible + 0.999999) / 0.18);

    const possible_f = [];
    for (let j = j_min; j <= j_max; j++) {
      const internal = j * 0.18;
      possible_f.push(internal - startingVisible);
    }

    // isPossible now takes fEps
    function isPossible(S, initialF, maxTLocal, fEps) {
      let lo = initialF - fEps;
      let hi = initialF + fEps;
      let currentD = S;

      for (let t = 1; t <= maxTLocal; t++) {
        currentD *= ageFactor[t];

        const eff = effArr[t];
        const mult = multArr[t];
        const forbidden = forbiddenArr[t];
        const up = upArr[t];

        if (forbidden) {
          if (up) return false;
          continue;
        }

        const add = currentD * mult * eff;

        if (!up) {
          hi = Math.min(hi, 1.0 - add);
          if (lo >= hi) return false;
          lo += add;
          hi += add;
        } else {
          lo = Math.max(lo, 1.0 - add);
          if (lo >= hi) return false;
          lo += add - 1.0;
          hi += add - 1.0;
          currentD *= 0.92;
        }

        if (lo < 0) lo = 0;
        if (hi > 1) hi = 1;
        if (lo >= hi) return false;
      }
      return lo < hi;
    }

    // computeRangeForMaxT now takes fEps
    function computeRangeForMaxT(maxTLocal, fEps) {
      let globalMinS = Infinity;
      let globalMaxS = -Infinity;

      const COARSE_STEP = 0.0005;

      for (let f of possible_f) {
        let minSf = Infinity;
        let maxSf = -Infinity;

        for (let s = LOW; s <= HIGH; s += COARSE_STEP) {
          if (isPossible(s, f, maxTLocal, fEps)) {
            if (s < minSf) minSf = s;
            if (s > maxSf) maxSf = s;
          }
        }

        if (minSf === Infinity) continue;

        // refine min
        let l = LOW, r = minSf;
        for (let i = 0; i < 60; i++) {
          const m = (l + r) / 2;
          if (isPossible(m, f, maxTLocal, fEps)) r = m; else l = m;
        }
        const minPrecise = r;

        // refine max
        l = maxSf; r = HIGH;
        for (let i = 0; i < 60; i++) {
          const m = (l + r) / 2;
          if (isPossible(m, f, maxTLocal, fEps)) l = m; else r = m;
        }
        const maxPrecise = l;

        if (minPrecise <= maxPrecise) {
          if (minPrecise < globalMinS) globalMinS = minPrecise;
          if (maxPrecise > globalMaxS) globalMaxS = maxPrecise;
        }
      }

      if (globalMinS === Infinity) return null;
      return { minS: globalMinS, maxS: globalMaxS };
    }

    // First pass: strict
    let usedMaxT = maxT;
    let range = computeRangeForMaxT(usedMaxT, 1e-8);

    // Second pass: relaxed
    if (!range) {
      range = computeRangeForMaxT(usedMaxT, 1e-3);
    }

    if (!range) {
      results[skill] = { error: `No possible value for ${skill}` };
      continue;
    }

    const { minS, maxS } = range;

    const valueAtLevel0Min = (minS / preFactor) / basePow;
    const valueAtLevel0Max = (maxS / preFactor) / basePow;

    let curMin = minS, curMax = maxS;
    let prevA = playerData[0].age;
    let ups = 0;

    for (let t = 1; t <= usedMaxT; t++) {
      const ca = playerData[t].age;
      if (ca > prevA) {
        const prevCum = getCumulative(prevA);
        const currCum = getCumulative(ca);
        const factor = currCum / prevCum;
        curMin *= factor;
        curMax *= factor;
      }
      prevA = ca;
      if (playerData[t][skill] === playerData[t - 1][skill] + 1) ups++;
    }

    const powUps = Math.pow(0.92, ups);
    curMin *= powUps;
    curMax *= powUps;

    results[skill] = {
      valueAtLevel0Min: Number(valueAtLevel0Min.toFixed(6)),
      valueAtLevel0Max: Number(valueAtLevel0Max.toFixed(6)),
      currentTrainingValueMin: Number(curMin.toFixed(6)),
      currentTrainingValueMax: Number(curMax.toFixed(6)),
      levelUps: ups,
      usedTrainings: usedMaxT + 1
    };
  }

  return results;
}

// Senior, no YS

function calculateTrainingValuesS(playerData) {
  const N = playerData.length;
  if (N < 2) return { error: "Need at least 2 snapshots" };

  const SKILLS = ['PAC', 'TEC', 'PAS', 'DEF', 'PM', 'STR', 'GK'];
  const DIRECT_MAP = { 8: 'PAC', 5: 'TEC', 6: 'DEF', 7: 'STR', 1: 'STA', 2: 'GK', 3: 'PM', 4: 'PAS' };
  const MAX_AT_0 = {
    'TEC': 1.05333333,
    'DEF': 1.05333333,
    'PAS': 1.13333333,
    'PM': 1.13333333,
    'PAC': 0.84666666,
    'STR': 0.9533333,
    'GK': 1.13333333
  };

  const AGE_MODIFIER = {
    17: 0.9469, 18: 0.9383779, 19: 0.9299324989, 20: 0.9215631064098999,
    21: 0.9132690384522109, 22: 0.905049617106141, 23: 0.8969041705521856,
    24: 0.8888320330172159, 25: 0.880832544720061, 26: 0.8729050518175805,
    27: 0.8650489063512222, 28: 0.8572634661940612, 29: 0.8495480949983146,
    30: 0.8419021621433298
  };

  function getPreLogFactor(startAge) {
    if (startAge <= 16) return 1.0;
    let factor = 1.0;
    for (let a = 17; a <= startAge; a++) {
      factor *= AGE_MODIFIER[a] || 0.991;
    }
    return factor;
  }

  const results = {};

  // Precompute per-week ageFactor
  const ageFactor = new Array(N).fill(1.0);
  for (let t = 1; t < N; t++) {
    const prevAge = playerData[t - 1].age;
    const currAge = playerData[t].age;
    if (currAge > prevAge) {
      let f = 1.0;
      for (let a = prevAge + 1; a <= currAge; a++) {
        f *= AGE_MODIFIER[a] || 0.991;
      }
      ageFactor[t] = f;
    }
  }

  for (let skill of SKILLS) {
    const maxAge = (skill === 'PAC') ? 28 : 30;

    // Precompute per-week arrays for this skill
    const effArr = new Array(N);
    const kindArr = new Array(N);
    const trArr = new Array(N);
    const directArr = new Array(N);
    const multArr = new Array(N);
    const upArr = new Array(N);
    const forbiddenArr = new Array(N);

    for (let t = 0; t < N; t++) {
      const row = playerData[t];
      effArr[t] = (row.EFF / 100) || 1.0;
      kindArr[t] = row.KIND || 1;
      trArr[t] = row.TR || 0;
      directArr[t] = DIRECT_MAP[trArr[t]] || null;
    }

    for (let t = 1; t < N; t++) {
      const row = playerData[t];
      const prevRow = playerData[t - 1];

      upArr[t] = (row[skill] === prevRow[skill] + 1);

      if (kindArr[t] === 3 || (skill === 'GK' && row.GKtrue !== 0)) {
        forbiddenArr[t] = true;
        multArr[t] = 0.0;
      } else {
        forbiddenArr[t] = false;
        let mult = (skill === directArr[t]) ? 1.0 : 0.15;
        if (kindArr[t] === 2 && skill === directArr[t]) mult = 0.24;
        multArr[t] = mult;
      }
    }

    // isPossible(S, maxT, fEps)
    function isPossible(S, maxTLocal, fEps) {
      let lo = 0.0 - fEps;
      let hi = 1.0 + fEps;
      let currentD = S;

      for (let t = 1; t <= maxTLocal; t++) {
        currentD *= ageFactor[t];

        if (forbiddenArr[t]) {
          if (upArr[t]) return false;
          continue;
        }

        const add = currentD * multArr[t] * effArr[t];

        if (!upArr[t]) {
          hi = Math.min(hi, 1.0 - add);
          if (lo >= hi) return false;
          lo += add; hi += add;
        } else {
          lo = Math.max(lo, 1.0 - add);
          if (lo >= hi) return false;
          lo += add - 1.0; hi += add - 1.0;
          currentD *= 0.92;
        }

        if (lo < 0) lo = 0;
        if (hi > 1) hi = 1;
        if (lo >= hi) return false;
      }
      return lo < hi;
    }
    
    // computeRangeForMaxT
    function computeRangeForMaxT(maxTLocal, fEps) {
      const startAge = playerData[0].age;
      const preFactor = getPreLogFactor(startAge);
      const startingN = playerData[0][skill];
      const LOW = 0.3 * preFactor * Math.pow(0.92, startingN);
      const HIGH = MAX_AT_0[skill] * preFactor * Math.pow(0.92, startingN);

      const COARSE_STEP = 0.0005;
      let globalMinS = Infinity;
      let globalMaxS = -Infinity;

      for (let s = LOW; s <= HIGH; s += COARSE_STEP) {
        if (isPossible(s, maxTLocal, fEps)) {
          if (s < globalMinS) globalMinS = s;
          if (s > globalMaxS) globalMaxS = s;
        }
      }

      if (globalMinS === Infinity) return null;

      // refine min
      let l = LOW, r = globalMinS;
      for (let i = 0; i < 60; i++) {
        const m = (l + r) / 2;
        if (isPossible(m, maxTLocal, fEps)) r = m; else l = m;
      }
      const minPrecise = r;

      // refine max
      l = globalMaxS; r = HIGH;
      for (let i = 0; i < 60; i++) {
        const m = (l + r) / 2;
        if (isPossible(m, maxTLocal, fEps)) l = m; else r = m;
      }
      const maxPrecise = l;

      return { minS: minPrecise, maxS: maxPrecise };
    }

    // Try full prefix → fallback
    let usedMaxT = N - 1;
    while (usedMaxT >= 1 && playerData[usedMaxT].age > maxAge) usedMaxT--;

    let range = computeRangeForMaxT(usedMaxT, 1e-8);
    if (!range) range = computeRangeForMaxT(usedMaxT, 1e-3);

    if (!range) {
      results[skill] = { error: `No possible value for ${skill}` };
      continue;
    }

    const { minS, maxS } = range;

    // Convert to level 0
    const startAge = playerData[0].age;
    const preFactor = getPreLogFactor(startAge);
    const startingN = playerData[0][skill];
    const valueAtLevel0Min = (minS / preFactor) / Math.pow(0.92, startingN);
    const valueAtLevel0Max = (maxS / preFactor) / Math.pow(0.92, startingN);

    // Compute current training values
    let curMin = minS, curMax = maxS;
    let prevA = startAge;
    let ups = 0;

    for (let t = 1; t <= usedMaxT; t++) {
      const ca = playerData[t].age;
      if (ca > prevA) {
        for (let a = prevA + 1; a <= ca; a++) {
          curMin *= AGE_MODIFIER[a] || 0.991;
          curMax *= AGE_MODIFIER[a] || 0.991;
        }
      }
      prevA = ca;
      if (playerData[t][skill] === playerData[t - 1][skill] + 1) ups++;
    }

    curMin *= Math.pow(0.92, ups);
    curMax *= Math.pow(0.92, ups);

    results[skill] = {
      valueAtLevel0Min: Number(valueAtLevel0Min.toFixed(6)),
      valueAtLevel0Max: Number(valueAtLevel0Max.toFixed(6)),
      currentTrainingValueMin: Number(curMin.toFixed(6)),
      currentTrainingValueMax: Number(curMax.toFixed(6)),
      levelUps: ups,
      usedTrainings: usedMaxT + 1
    };
  }

  return results;
}

processRows();