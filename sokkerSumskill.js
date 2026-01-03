document.querySelectorAll("[data-row-id]").forEach( async el => {
    const skills = (JSON.stringify(await getPlayerSumskill(el.dataset.rowId)));
})

async function getPlayerSumskill(id) {
    const res = await fetch("https://sokker.org/api/player/" + id);
    const player = await res.json();

    const stamina = player.info.skills.stamina;
    const keeper = player.info.skills.keeper;
    const pace = player.info.skills.pace;
    const def = player.info.skills.defending;
    const tech = player.info.skills.technique;
    const play = player.info.skills.playmaking;
    const pass = player.info.skills.passing;
    const striker = player.info.skills.striker;

    const sumskill = Number(stamina) + Number(keeper) + Number(pace) + Number(def) + Number(tech) + Number(play) + Number(pass) + Number(striker);

    return sumskill;
}







/*     https://sokker.org/api/player/el.dataset.rowId */