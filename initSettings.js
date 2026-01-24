chrome.storage.sync.get(null).then(settings => {
  if (Object.keys(settings).length === 0) {
    chrome.storage.sync.set({
      "sumskill-training": true,
      "adjustedSumskill-training": false,
      "midSumskill-training": true,
      "adjustedMidSumskill-training": false,
      "defSumskill-training": true,
      "attSumskill-training": true,
      "keeperSumskill-training": true,

      // TRANSFER
      "sumskill-transfer": true,
      "adjustedSumskill-transfer": false,
      "midSumskill-transfer": true,
      "adjustedMidSumskill-transfer": false,
      "defSumskill-transfer": false,
      "attSumskill-transfer": false,
      "keeperSumskill-transfer": false,

      // INDIVIDUAL
      "sumskill-individual": true,
      "adjustedSumskill-individual": false,
      "midSumskill-individual": true,
      "adjustedMidSumskill-individual": false,
      "defSumskill-individual": false,
      "attSumskill-individual": false,
      "keeperSumskill-individual": false,

      // Squad
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
      "keeperSumskill-player": true
    })
  }
})
