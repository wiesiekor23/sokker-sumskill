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

        browser.storage.sync.get([
            "sumskill-training",
            "adjSumskill-training",
            "midSumskill-training",
            "adjMidSumskill-training",
            "defSumskill-training",
            "attSumskill-training",
            "keeperSumskill-training",
            "sumskill-transfer",
            "adjSumskill-transfer",
            "midSumskill-transfer",
            "adjMidSumskill-transfer",
            "defSumskill-transfer",
            "attSumskill-transfer",
            "keeperSumskill-transfer"
        ], settings => {

            // Training Block
            if (settings["sumskill-training"]) {
                addBadge(el, sumskill, "sumskill", "Sumskill", ".table__cell--action");
            }

            if (settings["adjSumskill-training"]) {
                addBadge(el, adjustedSumskill, "adjustedSumskill", "Adjusted Sumskill", ".table__cell--action");
            }

            if (settings["midSumskill-training"]) {
                addBadge(el, midSumskill, "midSumskill", "MID Sumskill", ".table__cell--action");
            }

            if (settings["adjMidSumskill-training"]) {
                addBadge(el, adjustedMidSumskill, "adjustedMidSumskill", "Adjusted MID Sumskill", ".table__cell--action");
            }

            if (settings["defSumskill-training"]) {
                addBadge(el, defSumskill, "defSumskill", "DEF Sumskill", ".table__cell--action");
            }

            if (settings["attSumskill-training"]) {
                addBadge(el, attSumskill, "attSumskill", "ATT Sumskill", ".table__cell--action");
            }

            if (settings["keeperSumskill-training"]) {
                addBadge(el, keeperSumskill, "gkSumskill", "GK Sumskill", ".table__cell--action");
            }
            //Transfer Block
            if (settings["sumskill-transfer"]) {
                addBadge(el, sumskill, "sumskill", "Sumskill", ".table__cell--stop");
            }

            if (settings["adjSumskill-transfer"]) {
                addBadge(el, adjustedSumskill, "adjustedSumskill", "Adjusted Sumskill", ".table__cell--stop");
            }

            if (settings["midSumskill-transfer"]) {
                addBadge(el, midSumskill, "midSumskill", "MID Sumskill", ".table__cell--stop");
            }

            if (settings["adjMidSumskill-transfer"]) {
                addBadge(el, adjustedMidSumskill, "adjustedMidSumskill", "Adjusted MID Sumskill", ".table__cell--stop");
            }

            if (settings["defSumskill-transfer"]) {
                addBadge(el, defSumskill, "defSumskill", "DEF Sumskill", ".table__cell--stop");
            }

            if (settings["attSumskill-transfer"]) {
                addBadge(el, attSumskill, "attSumskill", "ATT Sumskill", ".table__cell--stop");
            }

            if (settings["keeperSumskill-transfer"]) {
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