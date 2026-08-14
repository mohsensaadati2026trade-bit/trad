// Inject script running in the web page window context to intercept WebSockets
(function() {
  const OriginalWebSocket = window.WebSocket;

  window.WebSocket = function(url, protocols) {
    const ws = new OriginalWebSocket(url, protocols);
    console.log("[Quotex Helper] WebSocket intercepted:", url);

    ws.addEventListener("message", (event) => {
      try {
        let data = event.data;
        if (typeof data === "string") {
          handleIncomingText(data);
        } else if (data instanceof ArrayBuffer) {
          handleIncomingBinary(data);
        } else if (data instanceof Blob) {
          data.arrayBuffer().then(buf => {
            handleIncomingBinary(buf);
          });
        }
      } catch (err) {
        // Prevent breaking Quotex app
      }
    });

    const originalSend = ws.send;
    ws.send = function(data) {
      try {
        if (typeof data === "string") {
          handleOutgoingText(data);
        }
      } catch (err) {
        // Prevent breaking
      }
      return originalSend.apply(this, arguments);
    };

    return ws;
  };

  // Maintain prototype chain
  window.WebSocket.prototype = OriginalWebSocket.prototype;
  // Copy static properties
  for (let key in OriginalWebSocket) {
    if (OriginalWebSocket.hasOwnProperty(key)) {
      window.WebSocket[key] = OriginalWebSocket[key];
    }
  }

  function handleIncomingText(data) {
    // Engine.io formatting checks (typically starts with numeric prefix, e.g., 42)
    const jsonStart = data.indexOf('[');
    if (jsonStart !== -1) {
      try {
        const jsonStr = data.substring(jsonStart);
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed) && parsed.length >= 2) {
          const eventName = parsed[0];
          const payload = parsed[1];

          window.postMessage({
            source: "quotex-ws-interceptor",
            direction: "incoming",
            type: "text",
            event: eventName,
            payload: payload
          }, "*");
        }
      } catch (e) {
        // Non-JSON format with brackets, skip parsing
      }
    } else {
      // Check if it's a simple key-value format (some brokers use customized strings)
      window.postMessage({
        source: "quotex-ws-interceptor",
        direction: "incoming",
        type: "raw-text",
        raw: data
      }, "*");
    }
  }

  function handleOutgoingText(data) {
    const jsonStart = data.indexOf('[');
    if (jsonStart !== -1) {
      try {
        const jsonStr = data.substring(jsonStart);
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed) && parsed.length >= 2) {
          const eventName = parsed[0];
          const payload = parsed[1];

          window.postMessage({
            source: "quotex-ws-interceptor",
            direction: "outgoing",
            type: "text",
            event: eventName,
            payload: payload
          }, "*");
        }
      } catch (e) {
        // Ignore parsing errors for outgoing
      }
    }
  }

  function handleIncomingBinary(arrayBuffer) {
    try {
      // Decode arrayBuffer as UTF-8 text to see if it is a string representation
      const decoder = new TextDecoder("utf-8");
      const decodedText = decoder.decode(arrayBuffer);

      // Check if it is a readable text format (like JSON or engine.io wrapped text)
      if (decodedText.includes("candle") || decodedText.includes("tick") || decodedText.includes("history") || decodedText.includes("[")) {
        handleIncomingText(decodedText);
      } else {
        // Send raw binary notification to content script
        window.postMessage({
          source: "quotex-ws-interceptor",
          direction: "incoming",
          type: "binary",
          byteLength: arrayBuffer.byteLength
        }, "*");
      }
    } catch (e) {
      // Failed to decode binary payload as text
    }
  }

  console.log("[Quotex Helper] Interceptor wrapper initialized successfully.");
})();
