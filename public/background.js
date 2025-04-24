chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "SEND_TO_CHATGPT") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        console.log("❌ No active tabs found.");
        return;
      }
    
      const youtubeTab = tabs[0];
      console.log("✅ tabs[0]:", youtubeTab);
    
      if (!youtubeTab.id || !youtubeTab.url) {
        console.log("❌ youtubeTab.id or url is missing.");
        return;
      }
    
      console.log("✅ Detected tab URL:", youtubeTab.url);
    
      if (!youtubeTab.url.match(/youtube\.com\/watch\?v=/)) {
        console.log("❌ Not on a valid YouTube video page.");
        return;
      }
    
      chrome.scripting.executeScript({
        target: { tabId: youtubeTab.id },
        files: ["content.js"],
      });

      sendResponse({ success: true }); // ✅ Tell the popup it was handled
    });

    // Return true to indicate async use of sendResponse
    return true;
  }

  if (request.type === "YOUTUBE_TRANSCRIPT") {
    chrome.storage.local.get("selectedChatTabId", ({ selectedChatTabId }) => {
      if (!selectedChatTabId) {
        console.log("❌ No ChatGPT tab selected.");
        return;
      }

      const prompt = `Summarize this YouTube transcript:\n\n${request.transcript}`;

      chrome.scripting.executeScript({
        target: { tabId: selectedChatTabId },
        func: (msg) => {
          const editor = document.querySelector(
            '[contenteditable="true"].ProseMirror'
          );
          if (editor) {
            editor.focus();
            document.execCommand("insertText", false, msg);
          }
        },
        args: [prompt],
      });
    });
  }
});
