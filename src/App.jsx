import { useState, useEffect } from "react";

const styleTag = document.createElement("style");
styleTag.textContent = `
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}`;
document.head.appendChild(styleTag);

function App() {
  const [chatTabs, setChatTabs] = useState([]);
  const [selectedTabId, setSelectedTabId] = useState(null);
  const [status, setStatus] = useState("");
  const [charCount, setCharCount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("00:00");

  useEffect(() => {
    const listener = (message, sender, sendResponse) => {
      if (message.type === "YOUTUBE_TRANSCRIPT_DONE") {
        setLoading(false);
        setStatus("✅ Transcript sent to ChatGPT!");
        if (message.charCount) {
          setCharCount(message.charCount);
        }
        setTimeout(() => setStatus(""), 4000);

        // ✅ Refresh ChatGPT tabs after sending
        chrome.tabs.query({}, (tabs) => {
          const matches = tabs.filter(
            (tab) => tab.url && tab.url.includes("chatgpt.com")
          );
          setChatTabs(matches);
        });
      }
    };

    chrome.runtime.onMessage.addListener(listener);

    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);

  // Load ChatGPT tabs + previously selected tab on popup open
  useEffect(() => {
    chrome.tabs.query({}, (tabs) => {
      const matches = tabs.filter(
        (tab) => tab.url && tab.url.includes("chatgpt.com")
      );
      setChatTabs(matches);
    });

    chrome.storage.local.get("selectedChatTabId", ({ selectedChatTabId }) => {
      if (selectedChatTabId) {
        setSelectedTabId(selectedChatTabId);
      }
    });
  }, []);

  // Fetch ChatGPT tabs and selected tab ID
  const handleSelect = (tabId) => {
    setSelectedTabId(tabId);
    if (chrome?.storage?.local) {
      chrome.storage.local.set({ selectedChatTabId: tabId });
    }
  };

  // Send message to ChatGPT tab
  const handleSend = () => {
    setStatus("Sending transcript...");
    setLoading(true);

    chrome.runtime.sendMessage(
      {
        type: "SEND_TO_CHATGPT",
        startTime,
        endTime,
      },
      (response) => {
        // safety: auto-clear loading if no response in 10s
        const safetyTimeout = setTimeout(() => {
          setLoading(false);
          setStatus(
            "❌ No response. Try refreshing YouTube or re-selecting a tab."
          );
        }, 10000);
      }
    );

    chrome.runtime.sendMessage({ type: "SEND_TO_CHATGPT" }, (response) => {
      chrome.scripting.executeScript({
        target: { tabId: youtubeTab.id },
        func: (start, end) => {
          window.transcriptSliceRange = { start, end };
        },
        args: [request.startTime, request.endTime]
      }, () => {
        chrome.scripting.executeScript({
          target: { tabId: youtubeTab.id },
          files: ["content.js"],
        });
      });      
      if (chrome.runtime.lastError) {
        clearTimeout(safetyTimeout);
        setLoading(false);
        setStatus("❌ Error: Unable to communicate with background.");
      } else {
        // don’t clear loading here — we’ll wait for the actual response
        // just keep charCount up to date
        if (response?.charCount) {
          setCharCount(response.charCount);
        }
      }
    });
  };

  return (
    <div style={{ padding: "10px" }}>
      <h4>Select ChatGPT Tab</h4>
      {chatTabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => handleSelect(tab.id)}
          style={{
            width: "100%",
            padding: "8px",
            marginBottom: "6px",
            backgroundColor: selectedTabId === tab.id ? "#4caf50" : "#f0f0f0",
            color: selectedTabId === tab.id ? "white" : "black",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          {tab.title}
        </button>
      ))}
      {status && (
        <p style={{ marginBottom: "10px", fontWeight: "bold" }}>{status}</p>
      )}
      {charCount !== null && (
        <p style={{ fontSize: "12px", marginBottom: "6px" }}>
          Transcript length: {charCount} characters
        </p>
      )}
      {loading && (
        <div style={{ marginBottom: "10px", textAlign: "center" }}>
          <div
            className="loader"
            style={{
              width: "24px",
              height: "24px",
              border: "4px solid #ccc",
              borderTop: "4px solid #4caf50",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto",
            }}
          ></div>
          <p style={{ fontSize: "12px", marginTop: "4px" }}>
            Fetching transcript…
          </p>
        </div>
      )}
      <div style={{ marginBottom: "10px" }}>
        <label>
          Start Time (mm:ss):
          <input
            type="text"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            placeholder="e.g., 02:15"
            style={{ width: "80px", marginLeft: "10px" }}
          />
        </label>
      </div>

      <div style={{ marginBottom: "10px" }}>
        <label>
          End Time (mm:ss):
          <input
            type="text"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            placeholder="e.g., 05:45"
            style={{ width: "80px", marginLeft: "14px" }}
          />
        </label>
      </div>

      <button onClick={handleSend} style={{ marginTop: "10px" }}>
        Send YouTube Summary
      </button>
    </div>
  );
}

export default App;
