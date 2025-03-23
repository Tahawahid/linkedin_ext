console.log("LinkedIn Job Extractor background script loaded");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.tab && message.action) {
    chrome.runtime.sendMessage(message);
  }
  return true;
});
