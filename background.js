// Quotex Assistant - Background Service Worker
chrome.runtime.onInstalled.addListener(() => {
  console.log("Quotex Candlestick Psychology & S&R Assistant Extension installed.");
});

// Listener for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "log") {
    console.log("[Extension Log]:", message.data);
    sendResponse({ status: "logged" });
  }
  return true;
});
