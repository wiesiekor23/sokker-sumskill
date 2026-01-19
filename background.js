browser.runtime.onInstalled.addListener(() => {
  browser.storage.sync.set({
    // TRAINING
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
    "keeperSumskill-individual": false
  });
});
