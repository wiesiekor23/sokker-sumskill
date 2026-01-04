function processRows() {
    document.querySelectorAll("[data-row-id]").forEach(async el => {
        if (el.dataset.sumskillAdded) return;
        el.dataset.sumskillAdded = "true";

        const player = await fetchPlayer(el.dataset.rowId);

        const sumskill = calcSumskill(player);
        const adjustedSumskill = calcAdjustedSumskill(player).toFixed(1);
        const midSumskill = calcMidSumskill(player);
        const adjustedMidSumskill = calcAdjustedMidsumskill(player).toFixed(1);
        const defSumskill = calcDefSumskill(player);
        const attSumskill = calcAttSumskill(player);
        const keeperSumskill = calcGkSumskill(player);

        addBadge(el, sumskill, "sumskill", "Sumskill");
        addBadge(el, adjustedSumskill, "adjustedSumskill", "Adjusted Sumskill");
        addBadge(el, midSumskill, "midSumskill", "MID Sumskill");
        addBadge(el, adjustedMidSumskill, "adjustedMidSumskill", "Adjusted MID Sumskill");
        addBadge(el, defSumskill, "defSumskill", "DEF Sumskill");
        addBadge(el, attSumskill, "attSumskill", "ATT Sumskill");
        addBadge(el, keeperSumskill, "gkSumskill", "GK Sumskill");
    });
}

async function fetchPlayer(id) {
    const res = await fetch(`https://sokker.org/api/player/${id}`);
    return res.json();
}

function calcSumskill(player) {
    const s = player.info.skills;
    return s.stamina + s.keeper + s.pace + s.defending + s.technique + s.playmaking + s.passing + s.striker;
}

function calcMidSumskill(player) {
    const s = player.info.skills;
    return s.pace + s.defending + s.technique + s.playmaking + s.passing;
}

function calcAdjustedMidsumskill(player) {
    const s = player.info.skills;
    return (s.pace * 1.51 + s.defending * 1.23 + s.technique * 1.13 + s.playmaking + s.passing) * 0.851;
}

function calcDefSumskill(player) {
    const s = player.info.skills;
    return s.pace + s.defending;
}

function calcAttSumskill(player) {
    const s = player.info.skills;
    return s.pace + s.technique + s.striker;
}

function calcAdjustedSumskill(player) {
    const s = player.info.skills;
    return (s.stamina + s.keeper + s.pace * 1.51 + s.defending * 1.23 + s.technique * 1.13 + s.playmaking + s.passing + s.striker * 1.23) * 0.865;
}

function calcGkSumskill(player) {
    const s = player.info.skills;
    return s.keeper + s.pace + s.passing;
}

function addBadge(row, value, className, tooltipText) {
    const container = row.querySelector(".table__cell--stop .table__cell-wrap");
    if (!container) return;

    const div = document.createElement("div");
    div.textContent = value;
    div.classList.add("badge", className);
    div.title = tooltipText;   // ← tooltip here

    container.appendChild(div);
}

const observer = new MutationObserver(processRows);
observer.observe(document.body, { childList: true, subtree: true });

processRows();