/* const ids = [
    "sumskill-training",
    "adjustedSumskill-training",
    "midSumskill-training",
    "adjustedMidSumskill-training",
    "defSumskill-training",
    "attSumskill-training",
    "keeperSumskill-training",
    "sumskill-transfer",
    "adjustedSumskill-transfer",
    "midSumskill-transfer",
    "adjustedMidSumskill-transfer",
    "defSumskill-transfer",
    "attSumskill-transfer",
    "keeperSumskill-transfer",
    "sumskill-individual",
    "adjustedSumskill-individual",
    "midSumskill-individual",
    "adjustedMidSumskill-individual",
    "defSumskill-individual",
    "attSumskill-individual",
    "keeperSumskill-individual"
]; */

// Get IDs of all elements matching selector
function getIds(selector) {
    const container = document.querySelectorAll(selector)
    return Array.from(container).map(i => i.id);
};

const trainingIds = getIds(`#training > label > *`);
const transferIds = getIds(`#transfers > label > *`);
const individualIds = getIds(`#individual > label > *`);
const squadIds = getIds(`#squad > label > *`)

// Load stored checkbox states
function getData(ids) {
    browser.storage.sync.get(ids).then(data => {
        ids.forEach(id => {
            const element = document.querySelector(`#${id}`);
             // Ensure value is boolean; default to false if undefined
            element.checked = Boolean(data[id]);
        })
    });
}

getData(trainingIds);
getData(transferIds);
getData(individualIds);
getData(squadIds)

// Save checkbox state on change
function setData(ids) {
    ids.forEach(id => {
        const element = document.querySelector(`#${id}`);
        element.addEventListener("change", () => {
            // Save the new checked state under its ID key
            browser.storage.sync.set({ [id]: element.checked });
        })
    })
}

setData(individualIds);
setData(trainingIds);
setData(transferIds);
setData(squadIds);