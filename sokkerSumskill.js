function processRows() {
    document.querySelectorAll("[data-row-id]").forEach(async el => {
        if (el.dataset.sumskillAdded) return;
        el.dataset.sumskillAdded = "true";

        const player = await fetchPlayer(el.dataset.rowId);

        const sumskill = calcSumskill(player);
        const midSumskill = calcMidSumskill(player);

        addBadge(el, sumskill, "sumskill", "Sumskill");
        addBadge(el, midSumskill, "midSumskill", "MID Sumskill");
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