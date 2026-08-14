// Content script running in the Quotex page scope
(function() {
  console.log("[Quotex Helper] Content script loaded.");

  // 1. Inject the WebSocket interceptor script
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("inject.js");
  script.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);

  // 2. Load custom CSS stylesheet
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.type = "text/css";
  link.href = chrome.runtime.getURL("overlay.css");
  (document.head || document.documentElement).appendChild(link);

  // 3. State Management Variables
  let candleHistory = [];      // Array of candle objects { time, open, close, high, low }
  let currentCandle = null;     // Current forming candle
  let activeAsset = "EUR/USD";
  let detectedTimeframe = 120;  // Default to 120 seconds (2m)
  let supportLevels = [];
  let resistanceLevels = [];
  let currentPrice = null;
  
  // Strategy States
  let activeSignal = null;       // 'call', 'put', null
  let signalTimer = 0;           // Remaining trade time in seconds
  let candleRemaining = 120;     // Remaining candle time in seconds
  let lastSignalTime = 0;        // Timestamp of the last triggered signal
  
  // User Config (Loaded from storage or defaulted)
  let isMuted = false;
  let minWickRatio = 0.45;        // Rejection wick must be >= 45% of total candle height
  let srPeriod = 3;              // Local peak/valley search radius
  let srClusterPercent = 0.03;   // Cluster threshold: 0.03%

  // 4. UI Elements References
  let hudElement = null;
  let lineOverlays = [];         // Store floating line elements

  // Load Settings from Storage
  chrome.storage.local.get(["isMuted", "minWickRatio", "srClusterPercent"], (result) => {
    if (result.isMuted !== undefined) isMuted = result.isMuted;
    if (result.minWickRatio !== undefined) minWickRatio = Number(result.minWickRatio);
    if (result.srClusterPercent !== undefined) srClusterPercent = Number(result.srClusterPercent);
    updateHUD();
  });

  // Listen to messages from popup settings
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "updateSettings") {
      if (message.settings.isMuted !== undefined) isMuted = message.settings.isMuted;
      if (message.settings.minWickRatio !== undefined) minWickRatio = Number(message.settings.minWickRatio);
      if (message.settings.srClusterPercent !== undefined) srClusterPercent = Number(message.settings.srClusterPercent);
      
      // Recalculate S&R with new clustering settings
      recalculateSR();
      updateHUD();
      sendResponse({ status: "success" });
    }
  });

  // 5. Setup WebSocket Data Interception Listener
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (msg && msg.source === "quotex-ws-interceptor") {
      handleWSData(msg);
    }
  });

  // Decode and handle websocket messages
  function handleWSData(msg) {
    // Scaffold parsing logic based on standard binary options stream events
    const payload = msg.payload;
    const event = msg.event;

    // Detect asset name from messages if available
    detectAsset();

    if (event === "candles" || event === "chart/candles" || event === "history" || (Array.isArray(payload) && payload.length > 20)) {
      parseCandleHistory(payload || msg.raw);
    } else if (event === "tick" || event === "candle/update" || event === "quote" || (payload && (payload.close !== undefined || payload.price !== undefined))) {
      handleLiveTick(payload);
    }
  }

  // Detect active asset from Quotex Page Title
  function detectAsset() {
    const title = document.title;
    if (title && title.includes(" - ")) {
      const parsedAsset = title.split(" - ")[0].trim();
      if (parsedAsset && parsedAsset !== activeAsset && parsedAsset.length < 15) {
        activeAsset = parsedAsset;
        // Clear history on asset change so we don't mix assets
        candleHistory = [];
        currentCandle = null;
        supportLevels = [];
        resistanceLevels = [];
        clearChartOverlays();
        updateHUD();
      }
    }
  }

  // Parse list of historical candles
  function parseCandleHistory(data) {
    let rawList = [];
    if (Array.isArray(data)) {
      rawList = data;
    } else {
      try {
        // Try parsing string payload
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) rawList = parsed;
        else if (parsed.data && Array.isArray(parsed.data)) rawList = parsed.data;
      } catch (e) {
        return;
      }
    }

    const parsedCandles = [];
    for (let item of rawList) {
      const c = normalizeCandle(item);
      if (c) parsedCandles.push(c);
    }

    if (parsedCandles.length > 10) {
      // Sort chronologically
      parsedCandles.sort((a, b) => a.time - b.time);
      
      // Auto-detect timeframe based on difference between last two candles
      if (parsedCandles.length >= 2) {
        const diffSeconds = Math.round(Math.abs(parsedCandles[parsedCandles.length - 1].time - parsedCandles[parsedCandles.length - 2].time));
        // Check if the timestamp is in milliseconds or seconds
        if (diffSeconds > 1000) {
          detectedTimeframe = Math.round(diffSeconds / 1000);
        } else {
          detectedTimeframe = diffSeconds;
        }
      }

      candleHistory = parsedCandles;
      // Use the last element as active forming candle
      currentCandle = candleHistory[candleHistory.length - 1];
      
      recalculateSR();
      updateHUD();
    }
  }

  // Handle a live price update or candle update
  function handleLiveTick(payload) {
    if (!payload) return;
    
    // Normalize live tick/candle info
    let price = null;
    let t = Math.floor(Date.now() / 1000);

    if (typeof payload === "number") {
      price = payload;
    } else {
      price = payload.close || payload.price || payload.last || payload.c;
      t = payload.time || payload.t || t;
    }

    if (price === null || price === undefined) return;
    currentPrice = Number(price);

    // Ensure timestamp is in seconds
    if (t > 1000000000000) t = Math.floor(t / 1000);

    // If we have no active candle, initialize one
    if (!currentCandle) {
      currentCandle = {
        time: t - (t % detectedTimeframe),
        open: currentPrice,
        close: currentPrice,
        high: currentPrice,
        low: currentPrice
      };
      candleHistory.push(currentCandle);
    }

    // Determine current candle bucket start time
    const bucketStart = t - (t % detectedTimeframe);

    if (bucketStart > currentCandle.time) {
      // Current candle closed, move to next candle
      // Check if last candle met criteria for signal BEFORE appending new one
      checkStrategyTrigger(currentCandle);

      // Append new candle
      currentCandle = {
        time: bucketStart,
        open: currentPrice,
        close: currentPrice,
        high: currentPrice,
        low: currentPrice
      };
      candleHistory.push(currentCandle);
      if (candleHistory.length > 200) candleHistory.shift();

      // Recalculate S&R
      recalculateSR();
    } else {
      // Update forming candle
      currentCandle.close = currentPrice;
      if (currentPrice > currentCandle.high) currentCandle.high = currentPrice;
      if (currentPrice < currentCandle.low) currentCandle.low = currentPrice;
    }

    // Calculate countdown timer
    candleRemaining = detectedTimeframe - (t % detectedTimeframe);
    
    if (activeSignal) {
      signalTimer = Math.max(0, signalTimer - 1);
      if (signalTimer <= 0) {
        activeSignal = null;
      }
    }

    updateHUD();
  }

  // Normalize candle data from various broker payload schemes
  function normalizeCandle(item) {
    if (!item) return null;
    let t, o, c, h, l;

    if (Array.isArray(item)) {
      if (item.length < 5) return null;
      t = item[0];
      
      // Auto-detect high/low/open/close indices mathematically
      const vals = item.slice(1, 5).map(Number);
      const maxVal = Math.max(...vals);
      const minVal = Math.min(...vals);
      const maxIdx = vals.indexOf(maxVal) + 1;
      const minIdx = vals.indexOf(minVal) + 1;

      if (maxIdx === 3 && minIdx === 4) {
        // [time, open, close, high, low]
        o = item[1];
        c = item[2];
      } else if (maxIdx === 2 && minIdx === 3) {
        // [time, open, high, low, close]
        o = item[1];
        c = item[4];
      } else {
        // Fallback guess
        o = item[1];
        c = item[2];
      }
      h = maxVal;
      l = minVal;
    } else if (typeof item === "object") {
      t = item.time || item.t || item.timestamp;
      o = item.open || item.o;
      c = item.close || item.c;
      h = item.high || item.h;
      l = item.low || item.l;
    }

    if (t === undefined || o === undefined || c === undefined || h === undefined || l === undefined) {
      return null;
    }

    // Normalize timestamp to seconds
    t = Number(t);
    if (t > 1000000000000) t = Math.floor(t / 1000);

    return {
      time: t,
      open: Number(o),
      close: Number(c),
      high: Number(h),
      low: Number(l)
    };
  }

  // 6. Calculate Support & Resistance
  function recalculateSR() {
    // Exclude the current active incomplete candle
    const completedCandles = candleHistory.slice(0, -1);
    if (completedCandles.length < srPeriod * 2 + 1) return;

    const peaks = [];
    const valleys = [];

    // Local peak/valley detection
    for (let i = srPeriod; i < completedCandles.length - srPeriod; i++) {
      const current = completedCandles[i];
      let isPeak = true;
      let isValley = true;

      for (let j = 1; j <= srPeriod; j++) {
        if (completedCandles[i - j].high >= current.high || completedCandles[i + j].high >= current.high) {
          isPeak = false;
        }
        if (completedCandles[i - j].low <= current.low || completedCandles[i + j].low <= current.low) {
          isValley = false;
        }
      }

      if (isPeak) peaks.push({ price: current.high, time: current.time });
      if (isValley) valleys.push({ price: current.low, time: current.time });
    }

    // Clustering S&R lines close to each other
    const cluster = (levels) => {
      if (levels.length === 0) return [];
      levels.sort((a, b) => a.price - b.price);

      const clusters = [];
      let activeCluster = [levels[0]];

      for (let i = 1; i < levels.length; i++) {
        const lastPrice = activeCluster[activeCluster.length - 1].price;
        const currentPrice = levels[i].price;
        const diffPercent = (Math.abs(currentPrice - lastPrice) / lastPrice) * 100;

        if (diffPercent <= srClusterPercent) {
          activeCluster.push(levels[i]);
        } else {
          clusters.push(mergeLevels(activeCluster));
          activeCluster = [levels[i]];
        }
      }
      clusters.push(mergeLevels(activeCluster));
      return clusters;
    };

    const mergeLevels = (list) => {
      const avgPrice = list.reduce((sum, item) => sum + item.price, 0) / list.length;
      return {
        price: avgPrice,
        strength: list.length,
        time: list[list.length - 1].time
      };
    };

    resistanceLevels = cluster(peaks).sort((a, b) => b.strength - a.strength).slice(0, 4);
    supportLevels = cluster(valleys).sort((a, b) => b.strength - a.strength).slice(0, 4);

    drawChartOverlays();
  }

  // 7. Candlestick Psychology Strategy Trigger Check
  function checkStrategyTrigger(candle) {
    if (!currentPrice || supportLevels.length === 0 || resistanceLevels.length === 0) return;

    // Standardize candle dimensions
    const range = candle.high - candle.low;
    if (range <= 0) return;

    const body = Math.abs(candle.close - candle.open);
    const upperWick = candle.high - Math.max(candle.open, candle.close);
    const lowerWick = Math.min(candle.open, candle.close) - candle.low;

    const upperWickRatio = upperWick / range;
    const lowerWickRatio = lowerWick / range;

    const proximityThreshold = currentPrice * 0.0003; // 0.03% distance buffer

    // Check for PUT Signal (Rejection at Resistance)
    for (let res of resistanceLevels) {
      // 1. High penetrated or reached resistance
      const reachedResistance = candle.high >= res.price - proximityThreshold;
      // 2. Closed below or right at resistance
      const closedBelow = candle.close <= res.price + proximityThreshold;
      // 3. Upper wick shows selling pressure (wick size >= minWickRatio)
      const hasRejectionWick = upperWickRatio >= minWickRatio;

      if (reachedResistance && closedBelow && hasRejectionWick) {
        triggerSignal("put");
        return;
      }
    }

    // Check for CALL Signal (Rejection at Support)
    for (let sup of supportLevels) {
      // 1. Low penetrated or reached support
      const reachedSupport = candle.low <= sup.price + proximityThreshold;
      // 2. Closed above or right at support
      const closedAbove = candle.close >= sup.price - proximityThreshold;
      // 3. Lower wick shows buying pressure (wick size >= minWickRatio)
      const hasRejectionWick = lowerWickRatio >= minWickRatio;

      if (reachedSupport && closedAbove && hasRejectionWick) {
        triggerSignal("call");
        return;
      }
    }
  }

  function triggerSignal(type) {
    // Prevent double triggering inside the same candle period
    const now = Date.now();
    if (now - lastSignalTime < (detectedTimeframe - 5) * 1000) return;
    
    lastSignalTime = now;
    activeSignal = type;
    signalTimer = detectedTimeframe; // Active for the next 2-minute candle duration

    if (!isMuted) {
      playAlertSound(type);
    }
    
    // Call user's chart overlay to draw signals on browser screen
    if (window.STP_ChartOverlay) {
      const xPos = window.innerWidth / 2 + (Math.random() * 200 - 100);
      const yPos = window.innerHeight / 2 + (Math.random() * 200 - 100);
      window.STP_ChartOverlay.drawSignal({
        direction: type.toUpperCase(),
        score: 100,
        text: type.toUpperCase()
      }, { x: xPos, y: yPos });
    }

    console.log(`[Quotex Strategy] triggered ${type.toUpperCase()} signal.`);
  }

  // Synthesize alerts using Web Audio API to bypass asset blocks
  function playAlertSound(type) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "call") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(880.00, ctx.currentTime + 0.3); // A5
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === "put") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(329.63, ctx.currentTime + 0.3); // E4
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch (e) {
      console.error("Web Audio failed:", e);
    }
  }

  // 8. Visual HUD Elements Creation
  function createHUD() {
    if (document.getElementById("quotex-hud-panel")) return;

    hudElement = document.createElement("div");
    hudElement.id = "quotex-hud-panel";
    hudElement.innerHTML = `
      <div class="hud-header" id="quotex-hud-header">
        <div class="hud-title">
          <div class="hud-pulse"></div>
          <span>QUOTEX PSYCHOLOGY AI</span>
        </div>
        <div class="hud-controls">
          <button class="hud-btn" id="hud-toggle-mute" title="Toggle Sound">🔊</button>
          <button class="hud-btn" id="hud-toggle-min" title="Minimize">➖</button>
        </div>
      </div>
      <div class="hud-content">
        <div class="hud-market-info">
          <div>ASSET: <span id="hud-asset" class="market-value">-</span></div>
          <div>TF: <span id="hud-tf" class="market-value">-</span></div>
        </div>

        <div class="hud-section">
          <div class="hud-section-title">Candle Wick Ratios</div>
          <div class="hud-progress-container">
            <div class="hud-progress-row">
              <div class="progress-label-wrap">
                <span>Upper Wick (Sell Pressure)</span>
                <span id="label-wick-upper">0%</span>
              </div>
              <div class="progress-bar-bg">
                <div class="progress-bar-fill wick-upper" id="bar-wick-upper"></div>
              </div>
            </div>
            <div class="hud-progress-row">
              <div class="progress-label-wrap">
                <span>Lower Wick (Buy Pressure)</span>
                <span id="label-wick-lower">0%</span>
              </div>
              <div class="progress-bar-bg">
                <div class="progress-bar-fill wick-lower" id="bar-wick-lower"></div>
              </div>
            </div>
            <div class="hud-progress-row">
              <div class="progress-label-wrap">
                <span>Candle Body Size</span>
                <span id="label-body">0%</span>
              </div>
              <div class="progress-bar-bg">
                <div class="progress-bar-fill body" id="bar-body"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="hud-section">
          <div class="hud-section-title">Nearest Levels</div>
          <div class="hud-levels-grid">
            <div class="hud-level-card">
              <span class="level-title">RESISTANCE</span>
              <span class="level-price res" id="hud-res-price">-</span>
              <span class="level-strength" id="hud-res-strength">Touches: -</span>
            </div>
            <div class="hud-level-card">
              <span class="level-title">SUPPORT</span>
              <span class="level-price sup" id="hud-sup-price">-</span>
              <span class="level-strength" id="hud-sup-strength">Touches: -</span>
            </div>
          </div>
        </div>

        <div class="hud-signal-banner" id="hud-signal-box">
          <span class="signal-direction-text">AI Signal State</span>
          <span class="signal-action" id="hud-signal-text">WAITING</span>
          <span class="signal-timer" id="hud-signal-timer">Candle Timer: 00s</span>
        </div>
      </div>
    `;

    document.body.appendChild(hudElement);

    // Setup Minimize / Mute listeners
    document.getElementById("hud-toggle-mute").addEventListener("click", () => {
      isMuted = !isMuted;
      chrome.storage.local.set({ isMuted });
      document.getElementById("hud-toggle-mute").innerText = isMuted ? "🔇" : "🔊";
    });

    document.getElementById("hud-toggle-min").addEventListener("click", () => {
      hudElement.classList.toggle("minimized");
      document.getElementById("hud-toggle-min").innerText = hudElement.classList.contains("minimized") ? "🔲" : "➖";
    });

    makeDraggable(hudElement, document.getElementById("quotex-hud-header"));
  }

  // Update HUD values dynamically
  function updateHUD() {
    if (!hudElement) createHUD();

    // Set mute icon status
    document.getElementById("hud-toggle-mute").innerText = isMuted ? "🔇" : "🔊";

    // Set Asset Name
    document.getElementById("hud-asset").innerText = activeAsset;

    // Set Timeframe Status
    const tfElement = document.getElementById("hud-tf");
    if (detectedTimeframe === 120) {
      tfElement.innerText = "2M (OK)";
      tfElement.className = "market-value timeframe-ok";
    } else {
      tfElement.innerText = `${Math.round(detectedTimeframe / 60)}M (WARN)`;
      tfElement.className = "market-value timeframe-warn";
    }

    // Set Active Candle Ratios
    if (currentCandle) {
      const range = currentCandle.high - currentCandle.low;
      if (range > 0) {
        const body = Math.abs(currentCandle.close - currentCandle.open);
        const upper = currentCandle.high - Math.max(currentCandle.open, currentCandle.close);
        const lower = Math.min(currentCandle.open, currentCandle.close) - currentCandle.low;

        const upperPct = Math.round((upper / range) * 100);
        const lowerPct = Math.round((lower / range) * 100);
        const bodyPct = Math.round((body / range) * 100);

        document.getElementById("label-wick-upper").innerText = `${upperPct}%`;
        document.getElementById("bar-wick-upper").style.width = `${upperPct}%`;

        document.getElementById("label-wick-lower").innerText = `${lowerPct}%`;
        document.getElementById("bar-wick-lower").style.width = `${lowerPct}%`;

        document.getElementById("label-body").innerText = `${bodyPct}%`;
        document.getElementById("bar-body").style.width = `${bodyPct}%`;
      }
    }

    // Set Nearest S&R levels
    if (resistanceLevels.length > 0) {
      const nearestRes = resistanceLevels[0];
      document.getElementById("hud-res-price").innerText = nearestRes.price.toFixed(5);
      document.getElementById("hud-res-strength").innerText = `Touches: ${nearestRes.strength}`;
    } else {
      document.getElementById("hud-res-price").innerText = "-";
      document.getElementById("hud-res-strength").innerText = "Touches: -";
    }

    if (supportLevels.length > 0) {
      const nearestSup = supportLevels[0];
      document.getElementById("hud-sup-price").innerText = nearestSup.price.toFixed(5);
      document.getElementById("hud-sup-strength").innerText = `Touches: ${nearestSup.strength}`;
    } else {
      document.getElementById("hud-sup-price").innerText = "-";
      document.getElementById("hud-sup-strength").innerText = "Touches: -";
    }

    // Update Signals
    const signalBox = document.getElementById("hud-signal-box");
    const signalText = document.getElementById("hud-signal-text");
    const signalTimerEl = document.getElementById("hud-signal-timer");

    // Standard format for countdown
    const formatTime = (sec) => {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    signalTimerEl.innerText = `Candle Timer: ${formatTime(candleRemaining)}`;

    signalBox.className = "hud-signal-banner";
    if (activeSignal === "call") {
      signalBox.classList.add("signal-call");
      signalText.innerText = "BUY (CALL) 🟢";
      signalTimerEl.innerText = `Trade Expiry: ${formatTime(signalTimer)}`;
    } else if (activeSignal === "put") {
      signalBox.classList.add("signal-put");
      signalText.innerText = "SELL (PUT) 🔴";
      signalTimerEl.innerText = `Trade Expiry: ${formatTime(signalTimer)}`;
    } else {
      signalText.innerText = "WAITING";
    }
  }

  // Draw visual line overlays on top of the trading chart area
  function drawChartOverlays() {
    clearChartOverlays();
    
    // Find the canvas container to overlays absolute lines
    const chartContainer = document.querySelector(".chart-container") || document.querySelector("canvas")?.parentElement;
    if (!chartContainer) return;

    // S&R pricing bounds
    const prices = [
      ...resistanceLevels.map(l => ({ ...l, type: "res" })),
      ...supportLevels.map(l => ({ ...l, type: "sup" }))
    ];

    prices.forEach((level) => {
      // Calculate relative vertical percentage of level based on visible chart scale
      // Since screen canvas price bounds are volatile to read directly, we display active prices
      // on HUD. For full chart drawing, we inject absolute overlays mapping coordinate ranges
      // when possible, or list them on screen. Let's create an overlays indicators panel on the left.
    });
  }

  function clearChartOverlays() {
    lineOverlays.forEach(el => el.remove());
    lineOverlays = [];
  }

  // Draggable logic for HUD
  function makeDraggable(element, header) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    header.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      e = e || window.event;
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e = e || window.event;
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      
      const newTop = element.offsetTop - pos2;
      const newLeft = element.offsetLeft - pos1;

      // Restrict boundaries
      if (newTop >= 0 && newTop <= window.innerHeight - element.offsetHeight) {
        element.style.top = newTop + "px";
      }
      if (newLeft >= 0 && newLeft <= window.innerWidth - element.offsetWidth) {
        element.style.left = newLeft + "px";
      }
    }

    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }

  // Initialize HUD once body is available
  if (document.body) {
    createHUD();
  } else {
    window.addEventListener("DOMContentLoaded", createHUD);
  }

})();
