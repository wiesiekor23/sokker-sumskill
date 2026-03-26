async function processRows() {
  const settings = await chrome.storage.sync.get(null) || {};

  await processData(`.table-row[data-row-id], .player-list__item, #body-player, .panel-body .well, .player__info`, getSkillsApi, settings); // API Fetch

  await processData(`.table-row.is-hovered.has-border`, getSkillsDom, settings); // DOM Fetch

  await processData(`tr[id^="juniorRow"]`, getJuniorCashed, settings);
}

async function processData(selector, skillsSource, settings) {
  const elements = document.querySelectorAll(selector);

  for (const el of elements) {
    // Prevent double‑processing the same row
    if (el.dataset.sumskillAdded) continue;
    el.dataset.sumskillAdded = true;

    let match;
    let juniorMatch;

    const pid = el.querySelector('a[href*="player/PID/"]');
    const element = document.querySelector(".ea");
    const juniorId = el.id.replace(`juniorRow`, ``);
   /*  const playerId = (el.textContent.match(/\d+/)[0]); */
    
    
    if (element && pid) {
      match = pid?.href.match(/\b\w+\b/g)
      addContainer();
    } else if (pid) {
      match = pid?.href.match(/\b\w+\b/g)
    } else if (juniorId) {
      juniorMatch = juniorId;
    }
    
    let source;
    
    if (match) {
      const idMatch = match[match.length - 1];
      source = idMatch;
    } else if (juniorMatch) {
      source = juniorMatch;
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
    individualPage: `.player__name`,
    individual: `.table__cell--eff`,
    squad: `.table__cell--copy, .player-box-header`,
    player: `.badge-container`,
    transferSearch: `#playerCell`,
    junior: 'tr[id^="juniorRow"] > td:nth-child(6)',
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
    talentJunior: `Talent`,
    weeksToPop: `Weeks to Next Pop`,
    currentLevel: `Current Estimated Level`
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
  if (s === undefined) return;
  const { talentJunior, weeksToPop, currentLevel } = s;

  if (!s) return;

  const sumskill = s.stamina + s.keeper + s.pace + s.defending + s.technique + s.playmaking + s.passing + s.striker;
  const midSumskill = s.pace + s.defending + s.technique + s.playmaking + s.passing;
  const adjustedMidSumskill = Number((s.pace * 1.51 + s.defending * 1.23 + s.technique * 1.13 + s.playmaking + s.passing) * 0.851).toFixed(1);
  const defSumskill = s.pace + s.defending;
  const attSumskill = s.pace + s.technique + s.striker;
  const adjustedSumskill = Number((s.stamina + s.keeper + s.pace * 1.51 + s.defending * 1.23 + s.technique * 1.13 + s.playmaking + s.passing + s.striker * 1.23) * 0.865).toFixed(1);
  const keeperSumskill = s.keeper + s.pace + s.passing;

  const talentSenior = await getTalentCashed(source, `Senior`);

  return {
    sumskill,
    adjustedSumskill,
    midSumskill,
    adjustedMidSumskill,
    attSumskill,
    defSumskill,
    keeperSumskill,
    talentSenior,
    talentJunior,
    weeksToPop,
    currentLevel
  };
}

async function getTalentCashed(id, prefix) {
  const talent = await chrome.storage.local.get(`${prefix} ${id}`);
  const talentS = talent[`${prefix} ${id}`];

  if (talentS) return talentS;

  if (id instanceof HTMLElement) return;

  const playerArray = (await transformIntoArray(id)).trainingArray;
  if (!Array.isArray(playerArray) || playerArray.length === 0) return "3.00-6.00";

  const isYS = (await transformIntoArray(id)).playerFromYS;
  let training;

  async function returnTalent() {
    const engineOne = await calculateTrainingValuesJ(playerArray);
    const engineTwo = await calculateTrainingValuesJExtr(playerArray);
    const engineOld = await calculateTrainingValuesS(playerArray);
    const talentOne = await calculateMinMax(engineOne);
    const talentTwo = await calculateMinMax(engineTwo);
    const talentOld = await calculateMinMax(engineOld);
    if (isYS) {
      let talentMax = Number(talentOne.max.toFixed(2));
      let talentMin = Number(talentOne.min.toFixed(2));
      if (talentMax <= Number(talentOld.max.toFixed(2)) && talentMin >= Number(talentOld.min.toFixed(2))) {
        talentMax = Number(talentOld.max);
        talentMin = Number(talentOld.min);
      }
      if (Number(talentMax.toFixed(2)) <= Number(talentTwo.max.toFixed(2)) && Number(talentMin.toFixed(2)) >= Number(talentTwo.min.toFixed(2))) {
        talentMax = Number(talentTwo.max);
        talentMin = Number(talentTwo.min);
      }
      training = `${talentMax.toFixed(2)}-${talentMin.toFixed(2)}`;
    } else {
      training = `${talentOld.max.toFixed(2)}-${talentOld.min.toFixed(2)}`;
    }
    return training;
  }

  const talentSenior = await returnTalent();
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

async function fetchJuniorLevels(id) {
  if (id instanceof HTMLElement) return;

  const url = `https://sokker.org/api/junior/${id}/graph`;
  const response = await fetch(url);
  return response.json();
}

async function fetchTrainerSkills() {
  const url = `https://sokker.org/api/trainer`
  const response = await fetch(url);
  const trainersJSON = await response.json();

  let trainer = [];

  for (let index = trainersJSON.trainers.length - 1; index >= 0; index--) {
    const element = trainersJSON.trainers[index];

    if (element.assignment.code === 1) {
      trainer.push(element);
    }
  }

  if (trainer.length === 0) {
    return [`DEF`, `TEC`, `PAS`, `PM`, `STR`, `PAC`, `GK`];
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
  const firstWeek = trainingJSON.reports.length - 1;

  const teamwork = trainingJSON?.reports?.[firstWeek]?.skills?.teamwork ?? 1;
  const tacticalD = trainingJSON?.reports?.[firstWeek]?.skills?.tacticalDiscipline ?? 1;
  const experience = trainingJSON?.reports?.[firstWeek]?.skills?.experience ?? 1;

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

  if (teamwork === 0 && tacticalD === 0 && (experience === 0 || experience === 1)) {
    const playerFromYS = true;
    return { trainingArray, playerFromYS };
  } else {
    const playerFromYS = false;
    return { trainingArray, playerFromYS };
  }
}

async function getJuniorLevels(id) {
  const trainingJSON = await fetchJuniorLevels(id);
  if (trainingJSON === undefined) return;

  const juniorArray = [];

  for (let index = 0; index < trainingJSON.values.length; index++) {
    const element = trainingJSON.values[index];

    juniorArray.push(element.y);
  }
  return juniorArray;
}

const TECH_DEF_MOD = 0.1541;
const PASS_PM_GK_MOD = 0.1686;
const PAC_MOD = 0.1267;
const STR_MOD = 0.141;
const GT_MOD = 6.666667;

async function calculateMinMax(talentEngine) {

  const training = talentEngine;
  if (!training) return { "max": 2.996, "min": 6.004 };

  // GK
  let resultMINgk;
  let resultMAXgk;
  let predictedPopMinValueGK;
  let predictedPopMaxValueGK;
  let talentGkMin;
  let talentGkMax;
  let predictedPopMinGK;
  let predictedPopMaxGK;

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
  let predictedPopMinValueTEC;
  let predictedPopMaxValueTEC;
  let talentTecMin;
  let talentTecMax;
  let predictedPopMinTEC;
  let predictedPopMaxTEC;

  if (training.TEC === undefined) {
    resultMINtec = 0.562;
    resultMAXtec = 1.125;
    talentTecMin = TECH_DEF_MOD / (resultMINtec / GT_MOD) * 3;
    talentTecMax = TECH_DEF_MOD / (resultMAXtec / GT_MOD) * 3;
    predictedPopMinTEC = TECH_DEF_MOD / (predictedPopMinValueTEC / GT_MOD) * 3;
    predictedPopMaxTEC = TECH_DEF_MOD / (predictedPopMaxValueTEC / GT_MOD) * 3;
  } else {
    resultMINtec = training.TEC.valueAtLevel0Min;
    resultMAXtec = training.TEC.valueAtLevel0Max;
    talentTecMin = TECH_DEF_MOD / (resultMINtec / GT_MOD) * 3;
    talentTecMax = TECH_DEF_MOD / (resultMAXtec / GT_MOD) * 3;
    predictedPopMinTEC = TECH_DEF_MOD / (predictedPopMinValueTEC / GT_MOD) * 3;
    predictedPopMaxTEC = TECH_DEF_MOD / (predictedPopMaxValueTEC / GT_MOD) * 3;
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
    let talentMin = 6;

    function checkMAX() {
      const values = [
        talentTecMax, talentDefMax, talentPassMax,
        talentPmMax, talentPacMax, talentStrMax, talentGkMax
      ];

      for (const v of values) {
        if (v > talentMax) {
          talentMax = v;
        }
      }

      return talentMax;
    }

    function checkMIN() {
      const values = [
        talentTecMin, talentDefMin, talentPassMin,
        talentPmMin, talentPacMin, talentStrMin, talentGkMin
      ];

      for (const v of values) {
        if (v < talentMin) {
          talentMin = v;
        }
      }

      return talentMin;
    }

    return { checkMAX, checkMIN };
  }


  const min = minMaxCheck().checkMIN();
  const max = minMaxCheck().checkMAX();

  return { max, min };
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

// Junior start

async function calculateTrainingValuesJ(playerData) {
  const skills = await getTrainerSkillsCached();
  const N = playerData.length;
  if (N < 2) return { error: "Need at least 2 snapshots" };

  const SKILLS = skills;
  const DIRECT_MAP = { 8: 'PAC', 5: 'TEC', 6: 'DEF', 7: 'STR', 3: 'PM', 4: 'PAS', 2: `GK` };

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

  const ageFactor = new Array(N).fill(1.0);
  for (let t = 1; t < N; t++) {
    const prevAge = playerData[t - 1].age;
    const currAge = playerData[t].age;
    if (currAge > prevAge) {
      ageFactor[t] = getCumulative(currAge) / getCumulative(prevAge);
    }
  }

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

    const startingN = playerData[0][skill];
    const j_min = Math.ceil(startingN / 0.18);
    const j_max = Math.floor((startingN + 0.999999) / 0.18);
    const possible_f = [];
    for (let j = j_min; j <= j_max; j++) {
      possible_f.push(j * 0.18 - startingN);
    }

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

  function isBPossible(B, fEps) {
    for (const skill of SKILLS) {
      const { S_factor, usedMaxT, possible_f } = sd[skill];
      if (usedMaxT < 1) continue;
      const S = B * S_factor;
      let anyValid = false;
      for (const f of possible_f) {
        if (isPossibleSkill(skill, S, f, usedMaxT, fEps)) {
          anyValid = true;
          break;
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

    const res = {
      valueAtLevel0Min: +minV0.toFixed(6),
      valueAtLevel0Max: +maxV0.toFixed(6),
      currentTrainingValueMin: +curMin.toFixed(6),
      currentTrainingValueMax: +curMax.toFixed(6),
      levelUps: ups,
      usedTrainings: usedMaxT + 1
    };

    // ---------------------------------------------------------
    // NEW: compute min/max needed for next pop
    // ---------------------------------------------------------
    let needMin = Infinity;
    let needMax = -Infinity;

    for (const f of sd[skill].possible_f) {
      const nMin = 1 - (f + curMax); // smallest needed
      const nMax = 1 - (f + curMin); // largest needed

      if (nMax > 0) {
        needMin = Math.min(needMin, nMin);
        needMax = Math.max(needMax, nMax);
      }
    }

    if (needMin === Infinity) {
      res.nextPop = { error: "Cannot pop further" };
    } else {
      res.nextPop = {
        minNeeded: +Math.max(0, needMin).toFixed(6),
        maxNeeded: +Math.max(0, needMax).toFixed(6)
      };
    }

    results[skill] = res;
  }

  return results;
}

// Senior, no YS

async function calculateTrainingValuesS(playerData) {
  const skills = await getTrainerSkillsCached();
  const N = playerData.length;
  if (N < 2) return { error: "Need at least 2 snapshots" };

  const SKILLS = skills;
  const DIRECT_MAP = { 8: 'PAC', 5: 'TEC', 6: 'DEF', 7: 'STR', 2: 'GK', 3: 'PM', 4: 'PAS' };

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

    const startingN = playerData[0][skill];
    const S_factor = RATIO[skill] * preFactor * Math.pow(0.92, startingN);

    let usedMaxT = N - 1;
    while (usedMaxT >= 1 && playerData[usedMaxT].age > maxAge) usedMaxT--;

    sd[skill] = { effArr, upArr, multArr, forbiddenArr, startingN, S_factor, usedMaxT };
  }

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

  function isBPossible(B, fEps) {
    for (const skill of SKILLS) {
      const { S_factor, usedMaxT } = sd[skill];
      if (!isPossibleSkill(skill, B * S_factor, usedMaxT, fEps)) return false;
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

    const minV0 = minB * RATIO[skill];
    const maxV0 = maxB * RATIO[skill];

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

// KEEP!!! FAST but not as robust with a lot of data - KEEP!!!

async function calculateTrainingValuesJExtr(playerData) {
  const skills = await getTrainerSkillsCached();
  const N = playerData.length;
  if (N < 2) return { error: "Need at least 2 snapshots" };

  const SKILLS = skills;
  const DIRECT_MAP = { 8: 'PAC', 5: 'TEC', 6: 'DEF', 7: 'STR', 3: 'PM', 4: 'PAS', 2: 'GK' };

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

  const ageFactor = new Array(N).fill(1.0);
  for (let t = 1; t < N; t++) {
    const prevAge = playerData[t - 1].age;
    const currAge = playerData[t].age;
    if (currAge > prevAge) {
      ageFactor[t] = getCumulative(currAge) / getCumulative(prevAge);
    }
  }

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

    const startingN = playerData[0][skill];
    const j_min = Math.ceil(startingN / 0.18);
    const j_max = Math.floor((startingN + 0.999999) / 0.18);
    const possible_f = [];
    for (let j = j_min; j <= j_max; j++) {
      possible_f.push(j * 0.18 - startingN);
    }

    const S_factor = RATIO[skill] * preFactor * Math.pow(0.92, startingN);

    const ktArr = new Array(N).fill(0.0);
    let decayExp = 0;
    let cumulAge = 1.0;
    for (let t = 1; t < N; t++) {
      cumulAge *= ageFactor[t];
      if (!forbiddenArr[t]) {
        ktArr[t] = cumulAge * Math.pow(0.92, decayExp) * multArr[t] * effArr[t];
        if (upArr[t]) decayExp++;
      }
    }

    sd[skill] = { upArr, forbiddenArr, possible_f, startingN, S_factor, usedMaxT, ktArr };
  }

  const SOLVER_EPS = 1e-9;

  // STRICT MODE
  function analyticalSInterval(skill, f0, maxT) {
    const { ktArr, upArr, forbiddenArr } = sd[skill];

    let a = 0, b = f0;
    let sLo = 0, sHi = Infinity;

    for (let t = 1; t <= maxT; t++) {
      if (forbiddenArr[t]) {
        if (upArr[t]) return null;
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

  const B_LOW = 0.562;
  const B_HIGH = 1.125;

  function findBRangeAnalytical() {
    let validB = [[B_LOW, B_HIGH]];

    for (const skill of SKILLS) {
      const { S_factor, possible_f, usedMaxT } = sd[skill];
      if (usedMaxT < 1) continue;

      const skillIntervals = [];
      for (const f0 of possible_f) {
        const si = analyticalSInterval(skill, f0, usedMaxT);
        if (!si) continue;
        const bLo = Math.max(B_LOW, si[0] / S_factor);
        const bHi = Math.min(B_HIGH, si[1] / S_factor);
        if (bLo < bHi) skillIntervals.push([bLo, bHi]);
      }

      if (!skillIntervals.length) return null;
      validB = intersectIntervalLists(validB, mergeIntervals(skillIntervals));
      if (!validB.length) return null;
    }

    return { minB: validB[0][0], maxB: validB[validB.length - 1][1], intervals: validB };
  }

  // RELAXED MODE

  function buildRelaxedConstraints(skill) {
    const { ktArr, upArr, forbiddenArr, usedMaxT } = sd[skill];
    const cs = [];
    let cumA = 0, numUps = 0;
    for (let t = 1; t <= usedMaxT; t++) {
      cumA += ktArr[t];
      if (forbiddenArr[t]) {
        if (upArr[t]) return null;
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
    if (M === -Infinity) return true;
    return M < 1 + SOLVER_EPS && m > -1 - SOLVER_EPS && M - m < 1 + SOLVER_EPS;
  }

  function findBRangeRelaxed() {
    let validB = [[B_LOW, B_HIGH]];

    for (const skill of SKILLS) {
      const { S_factor, usedMaxT } = sd[skill];
      if (usedMaxT < 1) continue;

      const cs = buildRelaxedConstraints(skill);
      if (cs === null) return null;
      if (cs.length === 0) continue;

      const sLow = B_LOW / S_factor;
      const sHigh = B_HIGH / S_factor;
      const feas = S => relaxedFeasible(cs, S);

      let midS = -1;
      const STEPS = 400;
      for (let i = 0; i <= STEPS; i++) {
        const S = sLow + (sHigh - sLow) * i / STEPS;
        if (feas(S)) { midS = S; break; }
      }
      if (midS < 0) return null;

      const sLoBound = feas(sLow) ? sLow : (() => {
        let lo = sLow, hi = midS;
        for (let i = 0; i < 60; i++) {
          const m = (lo + hi) / 2;
          feas(m) ? (hi = m) : (lo = m);
        }
        return hi;
      })();

      const sHiBound = feas(sHigh) ? sHigh : (() => {
        let lo = midS, hi = sHigh;
        for (let i = 0; i < 60; i++) {
          const m = (lo + hi) / 2;
          feas(m) ? (lo = m) : (hi = m);
        }
        return lo;
      })();

      const bLo = Math.max(B_LOW, sLoBound / S_factor);
      const bHi = Math.min(B_HIGH, sHiBound / S_factor);
      if (bLo >= bHi) return null;

      validB = intersectIntervalLists(validB, [[bLo, bHi]]);
      if (!validB.length) return null;
    }

    return { minB: validB[0][0], maxB: validB[validB.length - 1][1], intervals: validB };
  }

  // strict - relaxed - step-back
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

processRows();

function calculateJuniorTalent(history) {
  if (!history || history.length < 2) return 1;

  function approximateT95(df) {
    if (df <= 0) return Infinity;
    if (df === 1) return 12.71;
    if (df === 2) return 4.30;
    if (df === 3) return 3.18;
    if (df === 4) return 2.78;
    if (df === 5) return 2.57;
    if (df <= 10) return 2.23;
    if (df <= 20) return 2.09;
    if (df <= 30) return 2.04;
    return 1.96;
  }

  const n = history.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    const x = i + 1;
    const y = history[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  }

  const denominator = n * sumX2 - sumX * sumX;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  const currentWeek = n;
  const currentPredicted = Math.round((intercept + slope * currentWeek) * 100) / 100;

  const nextTarget = Math.floor(currentPredicted) + 1;

  let estimatedWeeksToNextPop;
  if (slope > 0) {
    const delta = nextTarget - currentPredicted;
    estimatedWeeksToNextPop = Math.round((delta / slope) * 1000) / 1000;
  } else {
    estimatedWeeksToNextPop = 12;
  }

  const talent = slope > 0
    ? Math.max(3, Math.round((1 / slope) * 100) / 100)
    : 12;

  let talentMin, talentMax;

  if (n === 2) {
    talentMin = 3;
    talentMax = 12;
  } else {
    const SSE = sumY2 - intercept * sumY - slope * sumXY;
    const MSE = SSE / (n - 2);
    const Sxx = sumX2 - (sumX * sumX) / n;
    const SE_slope = Math.sqrt(Math.abs(MSE) / Sxx);
    const t = approximateT95(n - 2);

    const slopeLow = slope - t * SE_slope;
    const slopeHigh = slope + t * SE_slope;

    talentMin = slopeLow > 0
      ? Math.max(3, Math.round((1 / slopeHigh) * 100) / 100)
      : 3;

    talentMax = slopeLow > 0
      ? Math.max(3, Math.round((1 / slopeLow) * 100) / 100)
      : 12;
  }

  return {
    talent,
    talentMin,
    talentMax,
    currentPredictedActualLevel: currentPredicted,
    estimatedWeeksToNextPop,
  };
}

async function getJuniorCashed(id) {
  const juniorArray = await getJuniorLevels(id);
  const juniorTalent = calculateJuniorTalent(juniorArray);

  let currentLevel = juniorTalent.currentPredictedActualLevel;
  let weeksToPop = Math.ceil(juniorTalent.estimatedWeeksToNextPop);
  let talentJunior = juniorTalent.talent;
  const talentMax = juniorTalent.talentMax;
  const talentMin = juniorTalent.talentMin;
  
  if (talentJunior === undefined) talentJunior = `__`;
  if (currentLevel === undefined) currentLevel = `__`;
  if (isNaN(weeksToPop)) weeksToPop = `__`;
  
  console.log(currentLevel, talentJunior, weeksToPop);

  return { talentJunior, weeksToPop, currentLevel };
}
/* 
function calculateJuniorTalent(historyRaw) {
  // 1. Sanitize input
  const history = (historyRaw || [])
    .map(v => Number(v))
    .filter(v => Number.isFinite(v));

  // If nothing valid, return defaults
  if (history.length === 0) {
    return {
      talent: 12,
      talentMin: 3,
      talentMax: 12,
      currentPredictedActualLevel: 0,
      estimatedWeeksToNextPop: 12,
    };
  }

  // If only 1 value, no slope possible
  if (history.length === 1) {
    return {
      talent: 12,
      talentMin: 3,
      talentMax: 12,
      currentPredictedActualLevel: history[0],
      estimatedWeeksToNextPop: 12,
    };
  }

  const n = history.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const x = i + 1;
    const y = history[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  }

  const denominator = n * sumX2 - sumX * sumX;
  let slope = (n * sumXY - sumX * sumY) / denominator;
  let intercept = (sumY - slope * sumX) / n;

  // 2. Stabilize slope
  if (!Number.isFinite(slope)) slope = 0;
  if (Math.abs(slope) < 1e-9) slope = 0;

  // 3. Predicted current level
  let currentPredicted = intercept + slope * n;
  if (!Number.isFinite(currentPredicted)) currentPredicted = history[n - 1];

  // 4. Next pop estimate
  let nextTarget = Math.floor(currentPredicted) + 1;
  let estimatedWeeksToNextPop = 12;

  if (slope > 0) {
    const delta = nextTarget - currentPredicted;
    estimatedWeeksToNextPop = delta / slope;
    if (!Number.isFinite(estimatedWeeksToNextPop) || estimatedWeeksToNextPop < 0)
      estimatedWeeksToNextPop = 12;
  }

  // 5. Talent calculation
  let talent = slope > 0 ? 1 / slope : 12;
  if (!Number.isFinite(talent)) talent = 12;

  // Clamp talent
  talent = Math.min(12, Math.max(3, talent));

  // 6. Confidence interval
  let talentMin = 3;
  let talentMax = 12;

  if (n > 2) {
    let SSE = sumY2 - intercept * sumY - slope * sumXY;
    if (SSE < 0) SSE = 0; // stabilize

    const MSE = SSE / (n - 2);
    const Sxx = sumX2 - (sumX * sumX) / n;
    const SE_slope = Math.sqrt(MSE / Sxx);

    const t = (n <= 3) ? 12.71 :
              (n <= 4) ? 4.30 :
              (n <= 5) ? 3.18 :
              (n <= 6) ? 2.78 :
              (n <= 7) ? 2.57 :
              (n <= 12) ? 2.23 :
              (n <= 22) ? 2.09 :
              (n <= 32) ? 2.04 : 1.96;

    const slopeLow = slope - t * SE_slope;
    const slopeHigh = slope + t * SE_slope;

    if (slopeLow > 0) {
      talentMin = 1 / slopeHigh;
      talentMax = 1 / slopeLow;
    }

    // Clamp
    talentMin = Math.min(12, Math.max(3, talentMin));
    talentMax = Math.min(12, Math.max(3, talentMax));
  }

  return {
    talent,
    talentMin,
    talentMax,
    currentPredictedActualLevel: currentPredicted,
    estimatedWeeksToNextPop,
  };
}
 */