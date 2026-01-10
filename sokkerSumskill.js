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

        chrome.storage.sync.get([
            "sumskill",
            "adjSumskill",
            "midSumskill",
            "adjMidSumskill",
            "defSumskill",
            "attSumskill",
            "keeperSumskill"
        ], settings => {

            if (settings.sumskill) {
                addBadge(el, sumskill, "sumskill", "Sumskill", ".table__cell--action");
                addBadge(el, sumskill, "sumskill", "Sumskill", ".table__cell--stop");
            }
            if (settings.adjSumskill) {
                addBadge(el, adjustedSumskill, "adjustedSumskill", "Adjusted Sumskill", ".table__cell--action");
                addBadge(el, adjustedSumskill, "adjustedSumskill", "Adjusted Sumskill", ".table__cell--stop");
            }
            if (settings.midSumskill) {
                addBadge(el, midSumskill, "midSumskill", "MID Sumskill", ".table__cell--stop");
                addBadge(el, midSumskill, "midSumskill", "MID Sumskill", ".table__cell--action");
            }
            if (settings.adjMidSumskill) {
                addBadge(el, adjustedMidSumskill, "adjustedMidSumskill", "Adjusted MID Sumskill", ".table__cell--action");
                addBadge(el, adjustedMidSumskill, "adjustedMidSumskill", "Adjusted MID Sumskill", ".table__cell--stop");
            }

            if (settings.defSumskill) {
                addBadge(el, defSumskill, "defSumskill", "DEF Sumskill", ".table__cell--action");
                addBadge(el, defSumskill, "defSumskill", "DEF Sumskill", ".table__cell--stop");
            }

            if (settings.attSumskill) {
                addBadge(el, attSumskill, "attSumskill", "ATT Sumskill", ".table__cell--action");
                addBadge(el, attSumskill, "attSumskill", "ATT Sumskill", ".table__cell--stop");
            }

            if (settings.keeperSumskill) {
                addBadge(el, keeperSumskill, "gkSumskill", "GK Sumskill", ".table__cell--action");
                addBadge(el, keeperSumskill, "gkSumskill", "GK Sumskill", ".table__cell--stop");
            }
        });
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

function addBadge(row, value, className, tooltipText, target) {
    const container = row.querySelector(target);
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