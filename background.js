async function initializeDefaults() {
  const defaults = {
    "sumskill-training": true,
    "adjustedSumskill-training": false,
    "midSumskill-training": true,
    "adjustedMidSumskill-training": false,
    "defSumskill-training": true,
    "attSumskill-training": true,
    "keeperSumskill-training": true,

    "sumskill-transfer": true,
    "adjustedSumskill-transfer": false,
    "midSumskill-transfer": true,
    "adjustedMidSumskill-transfer": false,
    "defSumskill-transfer": false,
    "attSumskill-transfer": false,
    "keeperSumskill-transfer": false,

    "sumskill-individual": true,
    "adjustedSumskill-individual": false,
    "midSumskill-individual": true,
    "adjustedMidSumskill-individual": false,
    "defSumskill-individual": false,
    "attSumskill-individual": false,
    "keeperSumskill-individual": false,

    "sumskill-squad": true,
    "adjustedSumskill-squad": false,
    "midSumskill-squad": true,
    "adjustedMidSumskill-squad": false,
    "defSumskill-squad": false,
    "attSumskill-squad": false,
    "keeperSumskill-squad": false,

    "sumskill-player": true,
    "adjustedSumskill-player": true,
    "midSumskill-player": true,
    "adjustedMidSumskill-player": true,
    "defSumskill-player": true,
    "attSumskill-player": true,
    "keeperSumskill-player": true,

    "sumskill-transferSearch": true,
    "adjustedSumskill-transferSearch": true,
    "midSumskill-transferSearch": true,
    "adjustedMidSumskill-transferSearch": true,
    "defSumskill-transferSearch": true,
    "attSumskill-transferSearch": true,
    "keeperSumskill-transferSearch": true,

    "talentSenior-squad": true,

    "talentSenior-training": true,

    "talentSenior-player": true,

    "talentJunior-junior": true,
    "weeksToPop-junior": true,
    "currentLevel-junior": true
  };

  // Get all existing sync values
  const current = await chrome.storage.sync.get(null);
  const missing = {};

  // Only set keys that do not exist yet
  for (const key in defaults) {
    if (!(key in current)) {
      missing[key] = defaults[key];
    }
  }

  if (Object.keys(missing).length > 0) {
    await chrome.storage.sync.set(missing);
  }
}

async function clearCache() {
  await chrome.storage.local.clear();
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    await initializeDefaults();
    await clearCache();
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await clearCache();
});