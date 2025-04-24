import { useState, useEffect } from "react";

function App() {
  const [chatTabs, setChatTabs] = useState([]);
  const [selectedTabId, setSelectedTabId] = useState(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    // Fetch ChatGPT tabs
    chrome.tabs.query({}, (tabs) => {
      const matches = tabs.filter(
        (tab) => tab.url && tab.url.includes("chatgpt.com")
      );
      setChatTabs(matches);
    });

    // Safe check before accessing chrome.storage
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.get("selectedChatTabId", ({ selectedChatTabId }) => {
        if (selectedChatTabId) {
          setSelectedTabId(selectedChatTabId);
        }
      });
    }
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

    chrome.runtime.sendMessage({ type: "SEND_TO_CHATGPT" }, (response) => {
      if (chrome.runtime.lastError) {
        setStatus("❌ Error: Unable to communicate with background.");
      } else {
        setStatus("✅ Transcript sent to ChatGPT!");
        setTimeout(() => setStatus(""), 4000); // clear after 4s
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

      <button onClick={handleSend} style={{ marginTop: "10px" }}>
        Send YouTube Summary
      </button>
    </div>
  );
}

export default App;
