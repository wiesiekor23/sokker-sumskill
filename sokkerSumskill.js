document.querySelectorAll("[data-row-id]").forEach( async el => {
    const sumskill = (JSON.stringify(await getPlayerSumskill(el.dataset.rowId)));
    displaySumskill(el, sumskill);
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

function displaySumskill(row, sumskill) {
    const sumskillContainer = row.querySelector(".table__cell--stop");

    const sumskillDiv = document.createElement("div");
    sumskillDiv.textContent = sumskill;
    sumskillDiv.classList.add("sumSkill");

    sumskillContainer.appendChild(sumskillDiv);
}




/*     https://sokker.org/api/player/el.dataset.rowId */