function App() {
  const handleClick = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab.url.includes("youtube.com/watch")) {
        const message = `Summarize this YouTube video:\n${tab.title}\n${tab.url}`;
        chrome.runtime.sendMessage({ type: "SEND_TO_CHATGPT", payload: message });
      } else {
        alert("Please open a YouTube video tab.");
      }
    });
  };

  return (
    <div style={{ padding: "10px" }}>
      <h3>Send to ChatGPT</h3>
      <button onClick={handleClick}>Summarize this tab</button>
    </div>
  );
}

export default App;
