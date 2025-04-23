import { useState, useEffect } from "react";

function App() {
  const [chatTabs, setChatTabs] = useState([]);
  const [selectedTabId, setSelectedTabId] = useState(null);

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

  const handleSelect = (tabId) => {
    setSelectedTabId(tabId);
    if (chrome?.storage?.local) {
      chrome.storage.local.set({ selectedChatTabId: tabId });
    }
  };

  const handleSend = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab.url.includes("youtube.com/watch")) {
        const message = `Summarize this YouTube video:\n${tab.title}\n${tab.url}`;
        chrome.runtime.sendMessage({
          type: "SEND_TO_CHATGPT",
          payload: message,
        });
      } else {
        alert("Please open a YouTube video first.");
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

      <button onClick={handleSend} style={{ marginTop: "10px" }}>
        Send YouTube Summary
      </button>
    </div>
  );
}

export default App;
