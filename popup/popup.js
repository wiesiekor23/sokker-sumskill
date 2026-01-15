/* const ids = [
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
 */

function getIds(selector) {
    const container = document.querySelectorAll(selector)
    return Array.from(container).map(i => i.id);
};

const trainingIds = getIds(`#training > label > *`);
const transferIds = getIds(`#transfers > label > *`)



function getData(ids) {
    browser.storage.sync.get(ids).then(data => {
        ids.forEach(id => {
            const element = document.querySelector(`#${id}`);
            element.checked = Boolean(data[id]);
        })
    });
}

getData(trainingIds);
getData(transferIds);

function setData(ids) {
    ids.forEach(id => {
        const element = document.querySelector(`#${id}`);
        element.addEventListener("change", () => {
            browser.storage.sync.set({ [id]: element.checked });
        })
    })
}

setData(trainingIds);
setData(transferIds);