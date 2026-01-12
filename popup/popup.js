const ids = [
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
];

// Load saved settings
browser.storage.sync.get(ids, data => {
    ids.forEach(id => {
        const el = document.getElementById(id);
        el.checked = data[id] ?? false;
    });
});

// Save settings when changed
ids.forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener("change", () => {
        browser.storage.sync.set({ [id]: el.checked });
    });
});