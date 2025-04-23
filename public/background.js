chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "SEND_TO_CHATGPT") {
    chrome.storage.local.get("selectedChatTabId", ({ selectedChatTabId }) => {
      if (selectedChatTabId == null) {
        console.log("❌ No ChatGPT tab selected.");
        return;
      }

      chrome.scripting.executeScript({
        target: { tabId: selectedChatTabId },
        func: (msg) => {
          const editor = document.querySelector('[contenteditable="true"].ProseMirror');
          if (editor) {
            editor.focus();
            document.execCommand("insertText", false, msg);
          } else {
            console.log("❌ ProseMirror input not found.");
          }
        },
        args: [request.payload]
      });
    });
  }
});
