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
  const adjustedSumskill = Number((s.stamina + s.keeper + s.pace * 1.51 + s.defending * 1.23 + s.technique * 1.13 + s.playmaking + s.passing + s.striker * 1.23) * 0.865).toFixed(1);
  const keeperSumskill = s.keeper + s.pace + s.passing;

  const talentSenior = await getTalentCashed(source, calculateMinMaxS, `Senior`);

  const talentSeniorYS = await getTalentCashed(source, calculateMinMaxJ, `Senior YS`);

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

async function getTalentCashed(id, talentCalc, prefix) {
  const talent = await chrome.storage.local.get(`${prefix} ${id}`);
  const talentS = talent[`${prefix} ${id}`];

  if (talentS) return talentS;

  const talentSenior = await talentCalc(id);
  chrome.storage.local.set({ [`${prefix} ${id}`]: talentSenior });
  return talentSenior;
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
  const storedSkills = await chrome.storage.local.get(id);
  const player = storedSkills[id];

  if (player) {
    const { stamina, pace, technique, passing, keeper, defending, playmaking, striker } = player.info.skills;
    return { stamina, pace, technique, passing, keeper, defending, playmaking, striker };
  }
  const playerFetched = await fetchPlayer(id);
  await chrome.storage.local.set({ [id]: playerFetched });

  const { stamina, pace, technique, passing, keeper, defending, playmaking, striker } = playerFetched.info.skills;
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
  if (id instanceof HTMLElement) return;

  const url = `https://sokker.org/api/training/${id}/report`;
  const response = await fetch(url);
  return response.json();
}

async function fetchTrainerSkills() {
  const url = `https://sokker.org/api/trainer`
  console.log(`still fetching`);
  const response = await fetch(url);
  const trainersJSON = await response.json();

  let trainer = [];

  for (let index = trainersJSON.trainers.length - 1; index >= 0; index--) {
    const element = trainersJSON.trainers[index];

    if (element.assignment.code === 1) {
      trainer.push(element);
    }
  }

  const trainerSkills = [];
  if (trainer[0].skills.defending.value === 16) trainerSkills.push(`DEF`);
  if (trainer[0].skills.technique.value === 16) trainerSkills.push(`TEC`);
  if (trainer[0].skills.passing.value === 16) trainerSkills.push(`PAS`);
  if (trainer[0].skills.playmaking.value === 16) trainerSkills.push(`PM`);
  if (trainer[0].skills.striker.value === 16) trainerSkills.push(`STR`);
  if (trainer[0].skills.pace.value === 16) trainerSkills.push(`PAC`);
  if (trainer[0].skills.keeper.value === 16) trainerSkills.push(`GK`);
  if (trainerSkills.length === 0) trainerSkills.push(`DEF`, `TEC`, `PAS`, `PM`, `STR`, `PAC`, `GK`);

  return trainerSkills;
}

async function transformIntoArray(id) {

  const trainingJSON = await fetchPlayerTraining(id);

  const trainingArray = [];

  if (trainingJSON === undefined) return;

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

const TECH_DEF_MOD = 0.1541;
const PASS_PM_GK_MOD = 0.1686;
const PAC_MOD = 0.1267;
const STR_MOD = 0.141;
const GT_MOD = 6.666667;

async function calculateMinMaxJ(id) {
  const playerArray = await transformIntoArray(id);
  if (!Array.isArray(playerArray) || playerArray.length === 0) return "0.0/0.0";

  const training = await calculateTrainingValuesJ(playerArray);
  if (!training) return "0.0/0.0";

  // GK
  let resultMINgk;
  let resultMAXgk;
  let talentGkMin;
  let talentGkMax;

  if (training.GK === undefined) {
    resultMINgk = 0.562;
    resultMAXgk = 1.125;
    talentGkMin = PASS_PM_GK_MOD / (resultMINgk / GT_MOD) * 3;
    talentGkMax = PASS_PM_GK_MOD / (resultMAXgk / GT_MOD) * 3;
  } else {
    resultMINgk = training.GK.valueAtLevel0Min;
    resultMAXgk = training.GK.valueAtLevel0Max;
    talentGkMin = PASS_PM_GK_MOD / (resultMINgk / GT_MOD) * 3;
    talentGkMax = PASS_PM_GK_MOD / (resultMAXgk / GT_MOD) * 3;
  }

  // TEC
  let resultMINtec;
  let resultMAXtec;
  let talentTecMin;
  let talentTecMax;

  if (training.TEC === undefined) {
    resultMINtec = 0.562;
    resultMAXtec = 1.125;
    talentTecMin = TECH_DEF_MOD / (resultMINtec / GT_MOD) * 3;
    talentTecMax = TECH_DEF_MOD / (resultMAXtec / GT_MOD) * 3;
  } else {
    resultMINtec = training.TEC.valueAtLevel0Min;
    resultMAXtec = training.TEC.valueAtLevel0Max;
    talentTecMin = TECH_DEF_MOD / (resultMINtec / GT_MOD) * 3;
    talentTecMax = TECH_DEF_MOD / (resultMAXtec / GT_MOD) * 3;
  }

  // DEF
  let resultMINdef;
  let resultMAXdef;
  let talentDefMin;
  let talentDefMax;

  if (training.DEF === undefined) {
    resultMINdef = 0.562;
    resultMAXdef = 1.125;
    talentDefMin = TECH_DEF_MOD / (resultMINdef / GT_MOD) * 3;
    talentDefMax = TECH_DEF_MOD / (resultMAXdef / GT_MOD) * 3;
  } else {
    resultMINdef = training.DEF.valueAtLevel0Min;
    resultMAXdef = training.DEF.valueAtLevel0Max;
    talentDefMin = TECH_DEF_MOD / (resultMINdef / GT_MOD) * 3;
    talentDefMax = TECH_DEF_MOD / (resultMAXdef / GT_MOD) * 3;
  }

  // PAS
  let resultMINpas;
  let resultMAXpas;
  let talentPassMin;
  let talentPassMax;

  if (training.PAS === undefined) {
    resultMINpas = 0.562;
    resultMAXpas = 1.125;
    talentPassMin = PASS_PM_GK_MOD / (resultMINpas / GT_MOD) * 3;
    talentPassMax = PASS_PM_GK_MOD / (resultMAXpas / GT_MOD) * 3;
  } else {
    resultMINpas = training.PAS.valueAtLevel0Min;
    resultMAXpas = training.PAS.valueAtLevel0Max;
    talentPassMin = PASS_PM_GK_MOD / (resultMINpas / GT_MOD) * 3;
    talentPassMax = PASS_PM_GK_MOD / (resultMAXpas / GT_MOD) * 3;
  }

  // PM
  let resultMINpm;
  let resultMAXpm;
  let talentPmMin;
  let talentPmMax;

  if (training.PM === undefined) {
    resultMINpm = 0.562;
    resultMAXpm = 1.125;
    talentPmMin = PASS_PM_GK_MOD / (resultMINpm / GT_MOD) * 3;
    talentPmMax = PASS_PM_GK_MOD / (resultMAXpm / GT_MOD) * 3;
  } else {
    resultMINpm = training.PM.valueAtLevel0Min;
    resultMAXpm = training.PM.valueAtLevel0Max;
    talentPmMin = PASS_PM_GK_MOD / (resultMINpm / GT_MOD) * 3;
    talentPmMax = PASS_PM_GK_MOD / (resultMAXpm / GT_MOD) * 3;
  }

  // PAC
  let resultMINpac;
  let resultMAXpac;
  let talentPacMin;
  let talentPacMax;

  if (training.PAC === undefined) {
    resultMINpac = 0.562;
    resultMAXpac = 1.125;
    talentPacMin = PAC_MOD / (resultMINpac / GT_MOD) * 3;
    talentPacMax = PAC_MOD / (resultMAXpac / GT_MOD) * 3;
  } else {
    resultMINpac = training.PAC.valueAtLevel0Min;
    resultMAXpac = training.PAC.valueAtLevel0Max;
    talentPacMin = PAC_MOD / (resultMINpac / GT_MOD) * 3;
    talentPacMax = PAC_MOD / (resultMAXpac / GT_MOD) * 3;
  }

  // STR
  let resultMINstr;
  let resultMAXstr;
  let talentStrMin;
  let talentStrMax;

  if (training.STR === undefined) {
    resultMINstr = 0.562;
    resultMAXstr = 1.125;
    talentStrMin = STR_MOD / (resultMINstr / GT_MOD) * 3;
    talentStrMax = STR_MOD / (resultMAXstr / GT_MOD) * 3;
  } else {
    resultMINstr = training.STR.valueAtLevel0Min;
    resultMAXstr = training.STR.valueAtLevel0Max;
    talentStrMin = STR_MOD / (resultMINstr / GT_MOD) * 3;
    talentStrMax = STR_MOD / (resultMAXstr / GT_MOD) * 3;
  }


  /*   console.log(`JUNIOR`);
    console.log(`${talentPassMax} - ${talentPassMin}`)
    console.log(`${talentPmMax} - ${talentPmMin}`)
    console.log(`${talentDefMax} - ${talentDefMin}`)
    console.log(`${talentTecMax} - ${talentTecMin}`)
    console.log(`${talentStrMax} - ${talentStrMin}`)
    console.log(`${talentPacMax} - ${talentPacMin}`) */
  /*     console.log(`${talentGkMax} - ${talentGkMin}`)  */

  function minMaxCheck() {
    let talentMax = 3;
    let talentMin = 7;

    function checkMAX() {
      talentMax = Math.max(
        talentMax,
        talentTecMax, talentDefMax, talentPassMax,
        talentPmMax, talentPacMax, talentStrMax, talentGkMax
      );
      return talentMax;
    }

    function checkMIN() {
      talentMin = Math.min(
        talentMin,
        talentTecMin, talentDefMin, talentPassMin,
        talentPmMin, talentPacMin, talentStrMin, talentGkMin
      );
      return talentMin;
    }

    return { checkMAX, checkMIN };
  }

  const min = minMaxCheck().checkMIN();
  const max = minMaxCheck().checkMAX();

  return `${max.toFixed(2)}-${min.toFixed(2)}`;
}

async function calculateMinMaxS(id) {
  const playerArray = await transformIntoArray(id);
  if (!Array.isArray(playerArray) || playerArray.length === 0) return "0.0/0.0";

  const training = await calculateTrainingValuesS(playerArray);
  if (!training) return "0.0/0.0";

  // GK
  let resultMINgk;
  let resultMAXgk;
  let talentGkMin;
  let talentGkMax;

  if (training.GK === undefined) {
    resultMINgk = 0.562;
    resultMAXgk = 1.125;
    talentGkMin = PASS_PM_GK_MOD / (resultMINgk / GT_MOD) * 3;
    talentGkMax = PASS_PM_GK_MOD / (resultMAXgk / GT_MOD) * 3;
  } else {
    resultMINgk = training.GK.valueAtLevel0Min;
    resultMAXgk = training.GK.valueAtLevel0Max;
    talentGkMin = PASS_PM_GK_MOD / (resultMINgk / GT_MOD) * 3;
    talentGkMax = PASS_PM_GK_MOD / (resultMAXgk / GT_MOD) * 3;
  }

  // TEC
  let resultMINtec;
  let resultMAXtec;
  let talentTecMin;
  let talentTecMax;

  if (training.TEC === undefined) {
    resultMINtec = 0.562;
    resultMAXtec = 1.125;
    talentTecMin = TECH_DEF_MOD / (resultMINtec / GT_MOD) * 3;
    talentTecMax = TECH_DEF_MOD / (resultMAXtec / GT_MOD) * 3;
  } else {
    resultMINtec = training.TEC.valueAtLevel0Min;
    resultMAXtec = training.TEC.valueAtLevel0Max;
    talentTecMin = TECH_DEF_MOD / (resultMINtec / GT_MOD) * 3;
    talentTecMax = TECH_DEF_MOD / (resultMAXtec / GT_MOD) * 3;
  }

  // DEF
  let resultMINdef;
  let resultMAXdef;
  let talentDefMin;
  let talentDefMax;

  if (training.DEF === undefined) {
    resultMINdef = 0.562;
    resultMAXdef = 1.125;
    talentDefMin = TECH_DEF_MOD / (resultMINdef / GT_MOD) * 3;
    talentDefMax = TECH_DEF_MOD / (resultMAXdef / GT_MOD) * 3;
  } else {
    resultMINdef = training.DEF.valueAtLevel0Min;
    resultMAXdef = training.DEF.valueAtLevel0Max;
    talentDefMin = TECH_DEF_MOD / (resultMINdef / GT_MOD) * 3;
    talentDefMax = TECH_DEF_MOD / (resultMAXdef / GT_MOD) * 3;
  }

  // PAS
  let resultMINpas;
  let resultMAXpas;
  let talentPassMin;
  let talentPassMax;

  if (training.PAS === undefined) {
    resultMINpas = 0.562;
    resultMAXpas = 1.125;
    talentPassMin = PASS_PM_GK_MOD / (resultMINpas / GT_MOD) * 3;
    talentPassMax = PASS_PM_GK_MOD / (resultMAXpas / GT_MOD) * 3;
  } else {
    resultMINpas = training.PAS.valueAtLevel0Min;
    resultMAXpas = training.PAS.valueAtLevel0Max;
    talentPassMin = PASS_PM_GK_MOD / (resultMINpas / GT_MOD) * 3;
    talentPassMax = PASS_PM_GK_MOD / (resultMAXpas / GT_MOD) * 3;
  }

  // PM
  let resultMINpm;
  let resultMAXpm;
  let talentPmMin;
  let talentPmMax;

  if (training.PM === undefined) {
    resultMINpm = 0.562;
    resultMAXpm = 1.125;
    talentPmMin = PASS_PM_GK_MOD / (resultMINpm / GT_MOD) * 3;
    talentPmMax = PASS_PM_GK_MOD / (resultMAXpm / GT_MOD) * 3;
  } else {
    resultMINpm = training.PM.valueAtLevel0Min;
    resultMAXpm = training.PM.valueAtLevel0Max;
    talentPmMin = PASS_PM_GK_MOD / (resultMINpm / GT_MOD) * 3;
    talentPmMax = PASS_PM_GK_MOD / (resultMAXpm / GT_MOD) * 3;
  }

  // PAC
  let resultMINpac;
  let resultMAXpac;
  let talentPacMin;
  let talentPacMax;

  if (training.PAC === undefined) {
    resultMINpac = 0.562;
    resultMAXpac = 1.125;
    talentPacMin = PAC_MOD / (resultMINpac / GT_MOD) * 3;
    talentPacMax = PAC_MOD / (resultMAXpac / GT_MOD) * 3;
  } else {
    resultMINpac = training.PAC.valueAtLevel0Min;
    resultMAXpac = training.PAC.valueAtLevel0Max;
    talentPacMin = PAC_MOD / (resultMINpac / GT_MOD) * 3;
    talentPacMax = PAC_MOD / (resultMAXpac / GT_MOD) * 3;
  }

  // STR
  let resultMINstr;
  let resultMAXstr;
  let talentStrMin;
  let talentStrMax;

  if (training.STR === undefined) {
    resultMINstr = 0.562;
    resultMAXstr = 1.125;
    talentStrMin = STR_MOD / (resultMINstr / GT_MOD) * 3;
    talentStrMax = STR_MOD / (resultMAXstr / GT_MOD) * 3;
  } else {
    resultMINstr = training.STR.valueAtLevel0Min;
    resultMAXstr = training.STR.valueAtLevel0Max;
    talentStrMin = STR_MOD / (resultMINstr / GT_MOD) * 3;
    talentStrMax = STR_MOD / (resultMAXstr / GT_MOD) * 3;
  }


  /*   console.log(`SENIOR`);
    console.log(`${talentPassMax} - ${talentPassMin}`)
    console.log(`${talentPmMax} - ${talentPmMin}`)
    console.log(`${talentDefMax} - ${talentDefMin}`)
    console.log(`${talentTecMax} - ${talentTecMin}`)
    console.log(`${talentStrMax} - ${talentStrMin}`)
    console.log(`${talentPacMax} - ${talentPacMin}`) */
  /*     console.log(`${talentGkMax} - ${talentGkMin}`)  */

  function minMaxCheck() {
    let talentMax = 3;
    let talentMin = 7;

    function checkMAX() {
      talentMax = Math.max(
        talentMax,
        talentTecMax, talentDefMax, talentPassMax,
        talentPmMax, talentPacMax, talentStrMax, talentGkMax
      );
      return talentMax;
    }

    function checkMIN() {
      talentMin = Math.min(
        talentMin,
        talentTecMin, talentDefMin, talentPassMin,
        talentPmMin, talentPacMin, talentStrMin, talentGkMin
      );
      return talentMin;
    }

    return { checkMAX, checkMIN };
  }

  const min = minMaxCheck().checkMIN();
  const max = minMaxCheck().checkMAX();

  return `${max.toFixed(2)}-${min.toFixed(2)}`;
}

async function getTrainerSkillsCached() {
  const { trainerSkills } = await chrome.storage.local.get("trainerSkills");

  if (trainerSkills) {
    return trainerSkills;
  }

  const skills = await fetchTrainerSkills();
  await chrome.storage.local.set({ trainerSkills: skills });
  return skills;
}


/* calculateMinMaxJ(39286054).then((min) => {
  console.log(min);
}) */

/* calculateMinMaxS(38914785).then((min) => {
  console.log(min);
}) */

// Junior start

async function calculateTrainingValuesJ(playerData) {
  const skills = await getTrainerSkillsCached();
  const N = playerData.length;
  if (N < 2) return { error: "Need at least 2 snapshots" };

  const SKILLS = skills;
  const DIRECT_MAP = { 8: 'PAC', 5: 'TEC', 6: 'DEF', 7: 'STR', 1: 'STA', 3: 'PM', 4: 'PAS', 2: `GK` };

  // Shared base B defined relative to PAS (ratio 1.0)
  const RATIO = { PAC: 0.75, TEC: 0.914, PAS: 1.0, DEF: 0.914, PM: 1.0, STR: 0.836, GK: 1 };

  const AGE_CUMULATIVE = {
    16: 1.0, 17: 0.9469, 18: 0.888003, 19: 0.825764, 20: 0.760995,
    21: 0.694578, 22: 0.628532, 23: 0.563964, 24: 0.501087,
    25: 0.440191, 26: 0.381630, 27: 0.325800, 28: 0.335700,
    29: 0.285200, 30: 0.240200
  };

  function getCumulative(age) {
    if (age <= 16) return 1.0;
    return AGE_CUMULATIVE[age] || AGE_CUMULATIVE[30];
  }

  // Precompute per-week age decay factors (shared across all skills)
  const ageFactor = new Array(N).fill(1.0);
  for (let t = 1; t < N; t++) {
    const prevAge = playerData[t - 1].age;
    const currAge = playerData[t].age;
    if (currAge > prevAge) {
      ageFactor[t] = getCumulative(currAge) / getCumulative(prevAge);
    }
  }

  // Precompute shared per-week scalars
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

  const startAge = playerData[0].age;
  const preFactor = getCumulative(startAge);

  // Precompute per-skill data
  const sd = {};
  for (const skill of SKILLS) {
    const maxAge = skill === 'PAC' ? 28 : 30;

    let usedMaxT = N - 1;
    for (let i = N - 1; i >= 0; i--) {
      if (playerData[i].age > maxAge) usedMaxT = i - 1;
      else break;
    }

    const multArr = new Array(N).fill(0.0);
    const upArr = new Array(N).fill(false);
    const forbiddenArr = new Array(N).fill(false);

    for (let t = 1; t < N; t++) {
      const row = playerData[t];
      const kind = kindArr[t];
      const direct = DIRECT_MAP[trArr[t]] || null;
      upArr[t] = (row[skill] === playerData[t - 1][skill] + 1);

      if (kind === 3 || (skill === 'GK' && gkTrueArr[t] !== 0)) {
        forbiddenArr[t] = true;
      } else {
        let mult = skill === direct ? 1.0 : 0.15;
        if (kind === 2 && skill === direct) mult = 0.24;
        multArr[t] = mult;
      }
    }

    // possible_f: fractional offsets for this skill's starting visible value
    const startingN = playerData[0][skill];
    const j_min = Math.ceil(startingN / 0.18);
    const j_max = Math.floor((startingN + 0.999999) / 0.18);
    const possible_f = [];
    for (let j = j_min; j <= j_max; j++) {
      possible_f.push(j * 0.18 - startingN);
    }

    // S_factor: converts B → S for this skill
    // S = B * RATIO[skill] * preFactor * 0.92^startingN
    const S_factor = RATIO[skill] * preFactor * Math.pow(0.92, startingN);

    sd[skill] = { multArr, upArr, forbiddenArr, possible_f, startingN, S_factor, usedMaxT };
  }

  function isPossibleSkill(skill, S, initialF, maxTLocal, fEps) {
    const { multArr, upArr, forbiddenArr } = sd[skill];
    let lo = initialF - fEps;
    let hi = initialF + fEps;
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

  // For a given B, every skill must have at least one valid f
  function isBPossible(B, fEps) {
    for (const skill of SKILLS) {
      const { S_factor, usedMaxT, possible_f } = sd[skill];
      if (usedMaxT < 1) continue; // skip age-exceeded skills
      const S = B * S_factor;
      let anyValid = false;
      for (const f of possible_f) {
        if (isPossibleSkill(skill, S, f, usedMaxT, fEps)) {
          anyValid = true;
          break; // one valid f is enough for this skill
        }
      }
      if (!anyValid) return false;
    }
    return true;
  }

  const B_LOW = 0.562;
  const B_HIGH = 1.125;
  const COARSE_STEP = 0.0005;

  function findBRange(fEps) {
    let minB = Infinity, maxB = -Infinity;
    for (let b = B_LOW; b <= B_HIGH; b += COARSE_STEP) {
      if (isBPossible(b, fEps)) {
        if (b < minB) minB = b;
        if (b > maxB) maxB = b;
      }
    }
    if (minB === Infinity) return null;

    let l, r;
    l = B_LOW; r = minB;
    for (let i = 0; i < 60; i++) {
      const m = (l + r) / 2;
      isBPossible(m, fEps) ? (r = m) : (l = m);
    }
    const minPrecise = r;

    l = maxB; r = B_HIGH;
    for (let i = 0; i < 60; i++) {
      const m = (l + r) / 2;
      isBPossible(m, fEps) ? (l = m) : (r = m);
    }
    const maxPrecise = l;

    return { minB: minPrecise, maxB: maxPrecise };
  }

  // Strict → relaxed → step-back fallback
  let range = findBRange(1e-8) || findBRange(1e-1);

  if (!range) {
    const maxUsed = Math.max(...SKILLS.map(s => sd[s].usedMaxT));
    for (let t = maxUsed - 1; t >= 1; t--) {
      for (const skill of SKILLS) {
        if (sd[skill].usedMaxT > t) sd[skill].usedMaxT = t;
      }
      range = findBRange(1e-8) || findBRange(1e-1);
      if (range) break;
    }
  }

  if (!range) return { error: "No valid base training value found across all skills" };

  const { minB, maxB } = range;
  const results = { _baseB: { min: +minB.toFixed(6), max: +maxB.toFixed(6) } };

  for (const skill of SKILLS) {
    const { startingN, S_factor, usedMaxT } = sd[skill];

    if (usedMaxT < 1) {
      results[skill] = { error: `No valid data for ${skill} (age exceeds limit)` };
      continue;
    }

    const minV0 = minB * RATIO[skill];
    const maxV0 = maxB * RATIO[skill];

    let curMin = minB * S_factor;
    let curMax = maxB * S_factor;
    let prevA = startAge;
    let ups = 0;

    for (let t = 1; t <= usedMaxT; t++) {
      const ca = playerData[t].age;
      if (ca > prevA) {
        const factor = getCumulative(ca) / getCumulative(prevA);
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
      valueAtLevel0Min: +minV0.toFixed(6),
      valueAtLevel0Max: +maxV0.toFixed(6),
      currentTrainingValueMin: +curMin.toFixed(6),
      currentTrainingValueMax: +curMax.toFixed(6),
      levelUps: ups,
      usedTrainings: usedMaxT + 1
    };
  }

  return results;
}

/* function calculateTrainingValuesJ(playerData) {
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
      range = computeRangeForMaxT(usedMaxT, 1e-1);
    }

    // Fallback loop: look for last valid week
    if (!range) {
      for (let t = usedMaxT - 1; t >= 1; t--) {
        let r1 = computeRangeForMaxT(t, 1e-8);
        let r2 = r1 || computeRangeForMaxT(t, 1e-1);
        if (r2) {
          usedMaxT = t;
          range = r2;
          break;
        }
      }
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
} */

// Senior, no YS

async function calculateTrainingValuesS(playerData) {
  const skills = await getTrainerSkillsCached();
  const N = playerData.length;
  if (N < 2) return { error: "Need at least 2 snapshots" };

  const SKILLS = skills;
  const DIRECT_MAP = { 8: 'PAC', 5: 'TEC', 6: 'DEF', 7: 'STR', 1: 'STA', 2: 'GK', 3: 'PM', 4: 'PAS' };

  // B = valueAtLevel0 for PAS (ratio 1.0 reference)
  const RATIO = { PAC: 0.75, TEC: 0.914, PAS: 1.0, DEF: 0.914, PM: 1.0, STR: 0.836, GK: 1.0 };

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
    for (let a = 17; a <= startAge; a++) factor *= AGE_MODIFIER[a] || 0.991;
    return factor;
  }

  const startAge = playerData[0].age;
  const preFactor = getPreLogFactor(startAge);

  // Precompute per-week age decay
  const ageFactor = new Array(N).fill(1.0);
  for (let t = 1; t < N; t++) {
    const prevAge = playerData[t - 1].age;
    const currAge = playerData[t].age;
    if (currAge > prevAge) {
      let f = 1.0;
      for (let a = prevAge + 1; a <= currAge; a++) f *= AGE_MODIFIER[a] || 0.991;
      ageFactor[t] = f;
    }
  }

  // Precompute all per-skill arrays once
  const sd = {};
  for (let skill of SKILLS) {
    const maxAge = skill === 'PAC' ? 28 : 30;
    const effArr = new Array(N);
    const upArr = new Array(N).fill(false);
    const multArr = new Array(N).fill(0.0);
    const forbiddenArr = new Array(N).fill(false);

    for (let t = 0; t < N; t++) {
      const row = playerData[t];
      effArr[t] = (row.EFF / 100) || 1.0;

      if (t > 0) {
        const kind = row.KIND || 1;
        const direct = DIRECT_MAP[row.TR || 0] || null;
        upArr[t] = (row[skill] === playerData[t - 1][skill] + 1);

        if (kind === 3 || (skill === 'GK' && row.GKtrue !== 0)) {
          forbiddenArr[t] = true;
        } else {
          let mult = skill === direct ? 1.0 : 0.15;
          if (kind === 2 && skill === direct) mult = 0.24;
          multArr[t] = mult;
        }
      }
    }

    // S_factor: converts B → S (the initial training value for this skill)
    // S_skill = B * RATIO[skill] * preFactor * 0.92^startingN
    const startingN = playerData[0][skill];
    const S_factor = RATIO[skill] * preFactor * Math.pow(0.92, startingN);

    let usedMaxT = N - 1;
    while (usedMaxT >= 1 && playerData[usedMaxT].age > maxAge) usedMaxT--;

    sd[skill] = { effArr, upArr, multArr, forbiddenArr, startingN, S_factor, usedMaxT };
  }

  // isPossible for one skill given its S value directly
  function isPossibleSkill(skill, S, maxTLocal, fEps) {
    const { effArr, upArr, multArr, forbiddenArr } = sd[skill];
    let lo = -fEps, hi = 1.0 + fEps;
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

  // The key function: test a single B against ALL skills simultaneously
  function isBPossible(B, fEps) {
    for (const skill of SKILLS) {
      const { S_factor, usedMaxT } = sd[skill];
      if (!isPossibleSkill(skill, B * S_factor, usedMaxT, fEps)) return false;
    }
    return true;
  }

  // Search B — since PAS has ratio 1.0, B ≈ valueAtLevel0_PAS
  // Tightest upper bound across skills: min(MAX_AT_0[skill] / RATIO[skill])
  const B_LOW = 0.562;
  const B_HIGH = 1.125;
  const COARSE_STEP = 0.0005;

  function findBRange(fEps) {
    let minB = Infinity, maxB = -Infinity;
    for (let b = B_LOW; b <= B_HIGH; b += COARSE_STEP) {
      if (isBPossible(b, fEps)) {
        if (b < minB) minB = b;
        if (b > maxB) maxB = b;
      }
    }
    if (minB === Infinity) return null;

    // Refine with binary search
    let l, r;
    l = B_LOW; r = minB;
    for (let i = 0; i < 60; i++) {
      const m = (l + r) / 2;
      isBPossible(m, fEps) ? (r = m) : (l = m);
    }
    const minPrecise = r;

    l = maxB; r = B_HIGH;
    for (let i = 0; i < 60; i++) {
      const m = (l + r) / 2;
      isBPossible(m, fEps) ? (l = m) : (r = m);
    }
    const maxPrecise = l;

    return { minB: minPrecise, maxB: maxPrecise };
  }

  // Try strict → relaxed → step-back fallback
  let range = findBRange(1e-8) || findBRange(1e-1);

  if (!range) {
    // Step back usedMaxT for all skills together
    const maxUsed = Math.max(...SKILLS.map(s => sd[s].usedMaxT));
    for (let t = maxUsed - 1; t >= 1; t--) {
      for (const skill of SKILLS) {
        if (sd[skill].usedMaxT > t) sd[skill].usedMaxT = t;
      }
      range = findBRange(1e-8) || findBRange(1e-1);
      if (range) break;
    }
  }

  if (!range) return { error: "No valid base training value found across all skills" };

  const { minB, maxB } = range;

  // Build per-skill results using the shared B range
  const results = { _baseB: { min: +minB.toFixed(6), max: +maxB.toFixed(6) } };

  for (const skill of SKILLS) {
    const { startingN, S_factor, usedMaxT } = sd[skill];

    // valueAtLevel0 = B * RATIO[skill]
    const minV0 = minB * RATIO[skill];
    const maxV0 = maxB * RATIO[skill];

    // Walk forward to get current training value
    let curMin = minB * S_factor;
    let curMax = maxB * S_factor;
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
      valueAtLevel0Min: +minV0.toFixed(6),
      valueAtLevel0Max: +maxV0.toFixed(6),
      currentTrainingValueMin: +curMin.toFixed(6),
      currentTrainingValueMax: +curMax.toFixed(6),
      levelUps: ups,
      usedTrainings: usedMaxT + 1
    };
  }

  return results;
}

/* function calculateTrainingValuesS(playerData) {
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

    // Try full prefix > walk back if needed
    let usedMaxT = N - 1;
    while (usedMaxT >= 1 && playerData[usedMaxT].age > maxAge) usedMaxT--;

    // Strict usedMaxT
    let range = computeRangeForMaxT(usedMaxT, 1e-8);

    // Relaxed usedMaxT
    if (!range) range = computeRangeForMaxT(usedMaxT, 1e-1);

    // Fallback: step back in time until valid week - nuclear option
     if (!range) {
      for (let t = usedMaxT - 1; t >= 1; t--) {
        let r1 = computeRangeForMaxT(t, 1e-8);
        let r2 = r1 || computeRangeForMaxT(t, 1e-1);
        if (r2) {
          usedMaxT = t;
          range = r2;
          break;
        }
      }
    }

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
} */

processRows();

/* // KEEP!!! FAST but not as robust with a lot of data - KEEP!!!

function calculateTrainingValuesJ(playerData) {
  const N = playerData.length;
  if (N < 2) return { error: "Need at least 2 snapshots" };

  const SKILLS = ['PAC', 'TEC', 'PAS', 'DEF', 'PM', 'STR'];
  const DIRECT_MAP = { 8: 'PAC', 5: 'TEC', 6: 'DEF', 7: 'STR', 1: 'STA', 3: 'PM', 4: 'PAS', 2: 'GK' };

  const RATIO = { PAC: 0.75, TEC: 0.914, PAS: 1.0, DEF: 0.914, PM: 1.0, STR: 0.836, GK: 0.836 };

  const AGE_CUMULATIVE = {
    16: 1.0,  17: 0.9469,   18: 0.888003, 19: 0.825764, 20: 0.760995,
    21: 0.694578, 22: 0.628532, 23: 0.563964, 24: 0.501087,
    25: 0.440191, 26: 0.381630, 27: 0.325800, 28: 0.335700,
    29: 0.285200, 30: 0.240200
  };

  function getCumulative(age) {
    if (age <= 16) return 1.0;
    return AGE_CUMULATIVE[age] || AGE_CUMULATIVE[30];
  }

  // ── Per-week age decay factors (shared across all skills) ─────────────────
  const ageFactor = new Array(N).fill(1.0);
  for (let t = 1; t < N; t++) {
    const prevAge = playerData[t - 1].age;
    const currAge = playerData[t].age;
    if (currAge > prevAge) {
      ageFactor[t] = getCumulative(currAge) / getCumulative(prevAge);
    }
  }

  // ── Shared per-week scalars ───────────────────────────────────────────────
  const effArr    = new Array(N);
  const kindArr   = new Array(N);
  const trArr     = new Array(N);
  const gkTrueArr = new Array(N);
  for (let t = 0; t < N; t++) {
    const row    = playerData[t];
    effArr[t]    = (row.EFF / 100) || 1.0;
    kindArr[t]   = row.KIND || 1;
    trArr[t]     = row.TR   || 0;
    gkTrueArr[t] = row.GKtrue || 0;
  }

  const startAge  = playerData[0].age;
  const preFactor = getCumulative(startAge);

  // ── Per-skill precomputation ──────────────────────────────────────────────
  const sd = {};
  for (const skill of SKILLS) {
    const maxAge = skill === 'PAC' ? 28 : 30;

    let usedMaxT = N - 1;
    for (let i = N - 1; i >= 0; i--) {
      if (playerData[i].age > maxAge) usedMaxT = i - 1;
      else break;
    }

    const multArr      = new Array(N).fill(0.0);
    const upArr        = new Array(N).fill(false);
    const forbiddenArr = new Array(N).fill(false);

    for (let t = 1; t < N; t++) {
      const row    = playerData[t];
      const kind   = kindArr[t];
      const direct = DIRECT_MAP[trArr[t]] || null;
      upArr[t] = (row[skill] === playerData[t - 1][skill] + 1);

      if (kind === 3 || (skill === 'GK' && gkTrueArr[t] !== 0)) {
        forbiddenArr[t] = true;
      } else {
        let mult = skill === direct ? 1.0 : 0.15;
        if (kind === 2 && skill === direct) mult = 0.24;
        multArr[t] = mult;
      }
    }

    // possible_f: discrete fractional offsets from integer multiples of 0.18
    const startingN = playerData[0][skill];
    const j_min = Math.ceil(startingN / 0.18);
    const j_max = Math.floor((startingN + 0.999999) / 0.18);
    const possible_f = [];
    for (let j = j_min; j <= j_max; j++) {
      possible_f.push(j * 0.18 - startingN);
    }

    // S_factor converts B → S for this skill  (S = B × S_factor)
    const S_factor = RATIO[skill] * preFactor * Math.pow(0.92, startingN);

    // ktArr[t] = linear coefficient of S in add_t
    // add_t = S × ktArr[t] = S × cumulAge[t] × 0.92^(non-forbidden ups before t) × mult_t × eff_t
    // This linearity is what makes every observation a half-plane constraint on S.
    const ktArr = new Array(N).fill(0.0);
    let decayExp = 0;
    let cumulAge = 1.0;
    for (let t = 1; t < N; t++) {
      cumulAge *= ageFactor[t];          // accumulate age factor even for forbidden weeks
      if (!forbiddenArr[t]) {
        ktArr[t] = cumulAge * Math.pow(0.92, decayExp) * multArr[t] * effArr[t];
        if (upArr[t]) decayExp++;        // increment AFTER use: counts ups at steps 1..t-1
      }
    }

    sd[skill] = { upArr, forbiddenArr, possible_f, startingN, S_factor, usedMaxT, ktArr };
  }

  const SOLVER_EPS = 1e-9;

  // ── STRICT MODE: analytical S-interval for a fixed discrete f0 ───────────
  // Tracks f(S) = a·S + b through the history, accumulating exact half-plane
  // constraints on S in a single O(N) forward pass.
  //
  // Limitation: only covers the discrete possible_f values (integer multiples
  // of 0.18 minus the integer part of the starting level). If the player's true
  // starting fraction falls between these values, this returns null.
  function analyticalSInterval(skill, f0, maxT) {
    const { ktArr, upArr, forbiddenArr } = sd[skill];

    let a = 0, b = f0;        // f(S) = a·S + b
    let sLo = 0, sHi = Infinity;

    for (let t = 1; t <= maxT; t++) {
      if (forbiddenArr[t]) {
        if (upArr[t]) return null;  // level-up in a forbidden week is impossible
        continue;
      }

      const newA = a + ktArr[t];
      const threshold = newA > 1e-15 ? (1 - b) / newA : Infinity;

      if (!upArr[t]) {
        sHi = Math.min(sHi, threshold + SOLVER_EPS);
        a = newA;
      } else {
        sLo = Math.max(sLo, threshold - SOLVER_EPS);
        a = newA;
        b -= 1;
      }

      if (b >= 1) return null;

      if (a > 1e-15) {
        if (b < 0) sLo = Math.max(sLo, -b / a - SOLVER_EPS);
        sHi = Math.min(sHi, (1 - b) / a + SOLVER_EPS);
      } else if (b < -SOLVER_EPS) {
        return null;
      }

      if (sLo >= sHi) return null;
    }

    return sLo < sHi ? [sLo, sHi] : null;
  }

  // ── Interval helpers ──────────────────────────────────────────────────────
  function mergeIntervals(intervals) {
    if (!intervals.length) return [];
    intervals.sort((x, y) => x[0] - y[0]);
    const out = [[...intervals[0]]];
    for (let i = 1; i < intervals.length; i++) {
      const last = out[out.length - 1];
      if (intervals[i][0] <= last[1]) last[1] = Math.max(last[1], intervals[i][1]);
      else out.push([...intervals[i]]);
    }
    return out;
  }

  function intersectIntervalLists(A, B) {
    const result = [];
    let i = 0, j = 0;
    while (i < A.length && j < B.length) {
      const lo = Math.max(A[i][0], B[j][0]);
      const hi = Math.min(A[i][1], B[j][1]);
      if (lo < hi) result.push([lo, hi]);
      if (A[i][1] < B[j][1]) i++; else j++;
    }
    return result;
  }

  const B_LOW  = 0.562;
  const B_HIGH = 1.125;

  // ── findBRangeAnalytical: strict mode ─────────────────────────────────────
  // For each skill, unions S-intervals across all discrete f0 candidates, then
  // intersects across skills.  Fast and precise when possible_f contains the
  // true starting fraction; returns null otherwise.
  function findBRangeAnalytical() {
    let validB = [[B_LOW, B_HIGH]];

    for (const skill of SKILLS) {
      const { S_factor, possible_f, usedMaxT } = sd[skill];
      if (usedMaxT < 1) continue;

      const skillIntervals = [];
      for (const f0 of possible_f) {
        const si = analyticalSInterval(skill, f0, usedMaxT);
        if (!si) continue;
        const bLo = Math.max(B_LOW,  si[0] / S_factor);
        const bHi = Math.min(B_HIGH, si[1] / S_factor);
        if (bLo < bHi) skillIntervals.push([bLo, bHi]);
      }

      if (!skillIntervals.length) return null;
      validB = intersectIntervalLists(validB, mergeIntervals(skillIntervals));
      if (!validB.length) return null;
    }

    return { minB: validB[0][0], maxB: validB[validB.length - 1][1], intervals: validB };
  }

  // ── RELAXED MODE: f0 free in [0, 1) ──────────────────────────────────────
  // Handles the case where the true starting fraction is not one of the discrete
  // possible_f values (e.g. when the player's training history predates the data).
  //
  // For a given S, define x_t(S) = c_t − A_t×S where:
  //   A_t = cumulative sum of ktArr[1..t]  (precomputed, fixed by the data)
  //   c_t = n_{t-1}     (no-up at t)  or  1 + n_{t-1}  (up at t)
  //   n_{t-1} = number of non-forbidden level-ups at steps 1..t-1
  //
  // Feasibility condition (∃ f0 ∈ [0,1) consistent with all observations):
  //   max_t x_t(S) < 1   AND   min_t x_t(S) > −1   AND   spread < 1
  // where spread = max_t x_t(S) − min_t x_t(S).
  //
  // All three conditions define linear constraints on S.  Their intersection is
  // a CONTIGUOUS interval (proved: spread is convex in S → sub-level set is
  // convex; the other two are half-lines), so binary search is exact.

  function buildRelaxedConstraints(skill) {
    const { ktArr, upArr, forbiddenArr, usedMaxT } = sd[skill];
    const cs = [];   // [c_t, A_t] pairs for non-forbidden steps ≤ usedMaxT
    let cumA = 0, numUps = 0;
    for (let t = 1; t <= usedMaxT; t++) {
      cumA += ktArr[t];              // ktArr[t]=0 for forbidden steps → safe to always add
      if (forbiddenArr[t]) {
        if (upArr[t]) return null;   // up in forbidden week: data is impossible
        continue;
      }
      cs.push([upArr[t] ? 1 + numUps : numUps, cumA]);
      if (upArr[t]) numUps++;
    }
    return cs;
  }

  function relaxedFeasible(cs, S) {
    let M = -Infinity, m = Infinity;
    for (const [c, A] of cs) {
      const x = c - A * S;
      if (x > M) M = x;
      if (x < m) m = x;
    }
    if (M === -Infinity) return true;    // no constraints: always feasible
    return M < 1 + SOLVER_EPS && m > -1 - SOLVER_EPS && M - m < 1 + SOLVER_EPS;
  }

  function findBRangeRelaxed() {
    let validB = [[B_LOW, B_HIGH]];

    for (const skill of SKILLS) {
      const { S_factor, usedMaxT } = sd[skill];
      if (usedMaxT < 1) continue;

      const cs = buildRelaxedConstraints(skill);
      if (cs === null) return null;      // impossible data (up in forbidden week)
      if (cs.length === 0) continue;    // no constraints → any B valid for this skill

      const sLow  = B_LOW  / S_factor;
      const sHigh = B_HIGH / S_factor;
      const feas  = S => relaxedFeasible(cs, S);

      // Coarse scan to locate any feasible S (feasible region is a contiguous
      // interval, so the scan only needs to find one point inside it)
      let midS = -1;
      const STEPS = 400;
      for (let i = 0; i <= STEPS; i++) {
        const S = sLow + (sHigh - sLow) * i / STEPS;
        if (feas(S)) { midS = S; break; }
      }
      if (midS < 0) return null;

      // Binary search left boundary (smallest feasible S)
      const sLoBound = feas(sLow) ? sLow : (() => {
        let lo = sLow, hi = midS;
        for (let i = 0; i < 60; i++) {
          const m = (lo + hi) / 2;
          feas(m) ? (hi = m) : (lo = m);
        }
        return hi;
      })();

      // Binary search right boundary (largest feasible S)
      const sHiBound = feas(sHigh) ? sHigh : (() => {
        let lo = midS, hi = sHigh;
        for (let i = 0; i < 60; i++) {
          const m = (lo + hi) / 2;
          feas(m) ? (lo = m) : (hi = m);
        }
        return lo;
      })();

      const bLo = Math.max(B_LOW,  sLoBound / S_factor);
      const bHi = Math.min(B_HIGH, sHiBound / S_factor);
      if (bLo >= bHi) return null;

      validB = intersectIntervalLists(validB, [[bLo, bHi]]);
      if (!validB.length) return null;
    }

    return { minB: validB[0][0], maxB: validB[validB.length - 1][1], intervals: validB };
  }

  // ── Solver: strict → relaxed → step-back (each step tries strict then relaxed)
  let range = findBRangeAnalytical() || findBRangeRelaxed();

  if (!range) {
    const maxUsed = Math.max(...SKILLS.map(s => sd[s].usedMaxT));
    for (let t = maxUsed - 1; t >= 1; t--) {
      for (const skill of SKILLS) {
        if (sd[skill].usedMaxT > t) sd[skill].usedMaxT = t;
      }
      range = findBRangeAnalytical() || findBRangeRelaxed();
      if (range) break;
    }
  }

  if (!range) return { error: "No valid base training value found across all skills" };

  const { minB, maxB } = range;
  const results = { _baseB: { min: +minB.toFixed(6), max: +maxB.toFixed(6) } };

  if (range.intervals.length > 1) {
    results._baseB.intervals = range.intervals.map(([lo, hi]) => ({
      min: +lo.toFixed(6), max: +hi.toFixed(6)
    }));
  }

  // ── Per-skill output ──────────────────────────────────────────────────────
  for (const skill of SKILLS) {
    const { startingN, S_factor, usedMaxT } = sd[skill];

    if (usedMaxT < 1) {
      results[skill] = { error: `No valid data for ${skill} (age exceeds limit)` };
      continue;
    }

    const minV0 = minB * RATIO[skill];
    const maxV0 = maxB * RATIO[skill];

    let curMin = minB * S_factor;
    let curMax = maxB * S_factor;
    let prevA  = startAge;
    let ups    = 0;

    for (let t = 1; t <= usedMaxT; t++) {
      const ca = playerData[t].age;
      if (ca > prevA) {
        const factor = getCumulative(ca) / getCumulative(prevA);
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
      valueAtLevel0Min:        +minV0.toFixed(6),
      valueAtLevel0Max:        +maxV0.toFixed(6),
      currentTrainingValueMin: +curMin.toFixed(6),
      currentTrainingValueMax: +curMax.toFixed(6),
      levelUps:                ups,
      usedTrainings:           usedMaxT + 1
    };
  }

  return results;
}
 */