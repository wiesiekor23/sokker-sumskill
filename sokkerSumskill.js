async function processRows() {
    const settings = await browser.storage.sync.get();
   
    await processData(`.table-row[data-row-id]`, getSkillsApi, settings);
    await processData(`.table-row.is-hovered`, getSkillsDom, settings); 
}

async function processData(selector, skillsSource, settings) {
    const elements = document.querySelectorAll(selector)

    for (const el of elements) {
        if (el.dataset.sumskillAdded) continue;
        el.dataset.sumskillAdded = true;

        const source = el.dataset.rowId ? el.dataset.rowId : el;
        const skills = await calculateSumskills(source, skillsSource);
        loadSettings(el, skills, settings);
    }
}

function loadSettings(el, skills, settings) {
    const selectors = {
        training: `.table__cell--effectiveness + .table__cell--action`,
        transfer: `.table__cell--stop, .table__cell--endDate + .table__cell--action`,
        individual: `.table__cell--eff`
    }

    const skillLabels = {
        sumskill: "Sumskill",
        adjustedSumskill: "Adjusted Sumskill",
        midSumskill: "MID Sumskill",
        adjustedMidSumskill: "Adjusted MID Sumskill",
        defSumskill: "DEF Sumskill",
        attSumskill: "ATT Sumskill",
        keeperSumskill: "GK Sumskill"
    }

    for (const prefixKey of Object.keys(skillLabels)) {
        for (const selector of Object.keys(selectors)) {
            const storageKey = `${prefixKey}-${selector}`;

            if (settings[storageKey]) {
                addBadge(el, skills[prefixKey], prefixKey, skillLabels[prefixKey], selectors[selector]);
            }
        }
    }
}

async function fetchPlayer(id) {
    const res = await fetch(`https://sokker.org/api/player/${id}`);
    return res.json();
}

async function calculateSumskills(source, fetchSkills) {
    const s = await fetchSkills(source);
    const sumskill = s.stamina + s.keeper + s.pace + s.defending + s.technique + s.playmaking + s.passing + s.striker;
    const midSumskill = s.pace + s.defending + s.technique + s.playmaking + s.passing;
    const adjustedMidSumskill = Number((s.pace * 1.51 + s.defending * 1.23 + s.technique * 1.13 + s.playmaking + s.passing) * 0.851).toFixed(1);
    const defSumskill = s.pace + s.defending;
    const attSumskill = s.pace + s.technique + s.striker;
    const adjustedSumskill = Number((s.stamina + s.keeper + s.pace * 1.51 + s.defending * 1.23 + s.technique * 1.13 + s.playmaking + s.passing + s.striker * 1.23) * 0.865).toFixed(1);
    const keeperSumskill = s.keeper + s.pace + s.passing;

    return {
        sumskill,
        adjustedSumskill,
        midSumskill,
        adjustedMidSumskill,
        attSumskill,
        defSumskill,
        keeperSumskill
    };
}

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

async function getSkillsApi(id) {
    const player = await fetchPlayer(id);
    const { stamina, pace, technique, passing, keeper, defending, playmaking, striker } = player.info.skills;
    return { stamina, pace, technique, passing, keeper, defending, playmaking, striker };
}

function addBadge(row, value, className, tooltipText, target) {
    const container = row.querySelector(target);
    if (!container) return;

    const div = document.createElement("div");
    div.textContent = value;
    div.classList.add("badge", className);
    div.title = tooltipText;   // ← tooltip here

    container.appendChild(div);
}

// Observer + debouncer

const observer = new MutationObserver(() => {
    clearTimeout(window._sumskillTimer);
    window._sumskillTimer = setTimeout(processRows, 10);
})
observer.observe(document.body, { childList: true, subtree: true });

processRows();