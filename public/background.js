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

      // 🧠 First, inject the time range into the page
      chrome.scripting.executeScript(
        {
          target: { tabId: youtubeTab.id },
          func: (start, end) => {
            window.transcriptSliceRange = { start, end };
          },
          args: [request.startTime, request.endTime],
        },
        () => {
          // ✅ Then inject content.js after the time range is set
          chrome.scripting.executeScript({
            target: { tabId: youtubeTab.id },
            files: ["content.js"],
          });
        }
      );
    });

    return true;
  }

  if (request.type === "YOUTUBE_TRANSCRIPT") {
    chrome.storage.local.get("selectedChatTabId", ({ selectedChatTabId }) => {
      if (!selectedChatTabId) {
        console.log("❌ No ChatGPT tab selected.");
        return;
      }

      const maxLength = 3000;
      const transcript = request.transcript.slice(0, maxLength);
      const prompt = `Summarize this YouTube transcript (length: ${transcript.length} characters):\n\n${transcript}`;

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
      // ✅ Tell popup that everything is done
      chrome.runtime.sendMessage({
        type: "YOUTUBE_TRANSCRIPT_DONE",
        charCount: transcript.length,
      });

      sendResponse({ charCount: transcript.length });
    });
  }
});
