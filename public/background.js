chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "SEND_TO_CHATGPT") {
    console.log("🔁 Received SEND_TO_CHATGPT:", request.payload);

    chrome.tabs.query({}, (tabs) => {
      const chatTab = tabs.find((t) => t.url && t.url.includes("chatgpt.com"));
      console.log("🧠 Found ChatGPT tab?", !!chatTab);

      if (chatTab) {
        chrome.scripting.executeScript({
          target: { tabId: chatTab.id },
          func: (msg) => {
            const editor = document.querySelector('[contenteditable="true"].ProseMirror');
            if (editor) {
              editor.focus();
              document.execCommand("insertText", false, msg);
            } else {
              console.log("❌ ProseMirror contenteditable not found.");
            }
          },
          args: [request.payload]
        });
        
      } else {
        console.log("❌ ChatGPT tab not found.");
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icon.png",
          title: "ChatGPT Tab Not Found",
          message: "Please open a chat.openai.com tab first."
        });
      }
    });
  }
});
