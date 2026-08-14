// Extension popup logic
document.addEventListener("DOMContentLoaded", () => {
  const muteToggle = document.getElementById("mute-toggle");
  const wickRatio = document.getElementById("wick-ratio");
  const wickRatioVal = document.getElementById("wick-ratio-val");
  const srCluster = document.getElementById("sr-cluster");
  const srClusterVal = document.getElementById("sr-cluster-val");

  // Load saved settings
  chrome.storage.local.get(["isMuted", "minWickRatio", "srClusterPercent"], (result) => {
    if (result.isMuted !== undefined) {
      muteToggle.checked = result.isMuted;
    }
    
    if (result.minWickRatio !== undefined) {
      const pct = Math.round(result.minWickRatio * 100);
      wickRatio.value = pct;
      wickRatioVal.innerText = `${pct}%`;
    }

    if (result.srClusterPercent !== undefined) {
      const step = Math.round(result.srClusterPercent * 100);
      srCluster.value = step;
      srClusterVal.innerText = `${result.srClusterPercent.toFixed(2)}%`;
    }
  });

  // Toggle Mute setting
  muteToggle.addEventListener("change", () => {
    const isMuted = muteToggle.checked;
    chrome.storage.local.set({ isMuted }, () => {
      syncSettings();
    });
  });

  // Slide Wick ratio setting
  wickRatio.addEventListener("input", () => {
    const pct = wickRatio.value;
    wickRatioVal.innerText = `${pct}%`;
  });

  wickRatio.addEventListener("change", () => {
    const minWickRatio = Number(wickRatio.value) / 100;
    chrome.storage.local.set({ minWickRatio }, () => {
      syncSettings();
    });
  });

  // Slide S&R cluster zone range setting
  srCluster.addEventListener("input", () => {
    const val = Number(srCluster.value) / 100;
    srClusterVal.innerText = `${val.toFixed(2)}%`;
  });

  srCluster.addEventListener("change", () => {
    const srClusterPercent = Number(srCluster.value) / 100;
    chrome.storage.local.set({ srClusterPercent }, () => {
      syncSettings();
    });
  });

  // Send message to content script on active tab to sync adjustments
  function syncSettings() {
    const isMutedVal = muteToggle.checked;
    const minWickRatioVal = Number(wickRatio.value) / 100;
    const srClusterPercentVal = Number(srCluster.value) / 100;

    const payload = {
      action: "updateSettings",
      settings: {
        isMuted: isMutedVal,
        minWickRatio: minWickRatioVal,
        srClusterPercent: srClusterPercentVal
      }
    };

    // Query active tab and send update
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, payload, (response) => {
          // Silent catch for tabs where the content script isn't loaded
          if (chrome.runtime.lastError) {
            console.log("Active tab does not have extension running.");
          }
        });
      }
    });
  }
});
