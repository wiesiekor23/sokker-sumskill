browser.runtime.onInstalled.addListener(() => {
  browser.storage.sync.set({
    "sumskill-training": true,
    "adjSumskill-training": false,
    "midSumskill-training": true,
    "adjMidSumskill-training": false,
    "defSumskill-training":true,
    "attSumskill-training":true,
    "keeperSumskill-training":true,
    "sumskill-transfer": true,
    "adjSumskill-transfer": false,
    "midSumskill-transfer": true,
    "adjMidSumskill-transfer": false,
    "defSumskill-transfer": false,
    "attSumskill-transfer": false,
    "keeperSumskill-transfer": false
  });
});