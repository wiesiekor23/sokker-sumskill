chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({
    sumskillAdvanced: false,
    sumskill: true,
    adjSumskill: false,
    midSumskill: true,
    adjMidSumskill: false,
    defSumskill: false,
    attSumskill: false,
    keeperSumskill: false
  });
});