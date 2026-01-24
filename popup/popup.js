// Get IDs of all elements matching selector
function getIds(selector) {
    const container = document.querySelectorAll(selector)
    return Array.from(container).map(i => i.id);
};

const trainingIds = getIds(`#training > label > *`);
const transferIds = getIds(`#transfers > label > *`);
const individualIds = getIds(`#individual > label > *`);
const squadIds = getIds(`#squad > label > *`);
const playerIds = getIds(`#player > label > *`);

// Load stored checkbox states
function getData(ids) {
    if (ids.length === 0) return;

    chrome.storage.sync.get(ids).then(data => {
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
getData(squadIds);
getData(playerIds);

// Save checkbox state on change
function setData(ids) {
    if (ids.length === 0) return;
    
    ids.forEach(id => {
        const element = document.querySelector(`#${id}`);
        element.addEventListener("change", () => {
            // Save the new checked state under its ID key
            chrome.storage.sync.set({ [id]: element.checked });
        })
    })
}

setData(individualIds);
setData(trainingIds);
setData(transferIds);
setData(squadIds);
setData(playerIds);