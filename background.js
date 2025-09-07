chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content.js"]
  });
  
  // Tell content script to toggle/reopen the toolbar
  chrome.tabs.sendMessage(tab.id, { action: "toggleToolbar" });
});
