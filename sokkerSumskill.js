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
/*             const player = element.textContent;
            match = player.match(/\b\w+\b/g); */
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


        const skills = await calculateSumskills(source, skillsSource);

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
        transferSearch: `#playerCell`
    };

    const skillLabels = {
        sumskill: "Sumskill",
        adjustedSumskill: "Adjusted Sumskill",
        midSumskill: "MID Sumskill",
        adjustedMidSumskill: "Adjusted MID Sumskill",
        defSumskill: "DEF Sumskill",
        attSumskill: "ATT Sumskill",
        keeperSumskill: "GK Sumskill"
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
async function calculateSumskills(source, fetchSkills) {
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
    window._sumskillTimer = setTimeout(processRows, 10); // Debounce to avoid spam
});

observer.observe(document.body, { childList: true, subtree: true });

// Initial run

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


processRows();