const ids = [
    "sumskillAdvanced",
    "sumskill",
    "adjSumskill",
    "midSumskill",
    "adjMidSumskill",
    "defSumskill",
    "attSumskill",
    "keeperSumskill"
];

const sumskillAdvanced = document.getElementById("sumskillAdvanced");
const sumskillOptions = document.getElementById("sumskillOptions");

// Load saved settings
chrome.storage.sync.get(ids, data => {
    ids.forEach(id => {
        const el = document.getElementById(id);
        el.checked = data[id] ?? false;
    });

    // Show/hide expandable section
    sumskillOptions.style.display = sumskillAdvanced.checked ? "block" : "none";
});

// Save settings when changed
ids.forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener("change", () => {
        chrome.storage.sync.set({ [id]: el.checked });

        // Update expandable section visibility
        if (id === "sumskillAdvanced") {
            sumskillOptions.style.display = el.checked ? "block" : "none";
        }
    });
});
