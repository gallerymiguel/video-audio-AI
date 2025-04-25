// ✅ Clean, working background.js for your Chrome Extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // ✅ Step 1: Handle YouTube Transcript Fetching
  if (request.type === "SEND_TO_CHATGPT") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        console.log("❌ No active tabs found.");
        return;
      }

      const youtubeTab = tabs[0];

      if (!youtubeTab.id || !youtubeTab.url) {
        console.log("❌ youtubeTab.id or url is missing.");
        return;
      }

      console.log("✅ Detected tab URL:", youtubeTab.url);

      if (!youtubeTab.url.match(/youtube\.com\/watch\?v=/)) {
        console.log("❌ Not on a valid YouTube video page.");
        return;
      }

      // Inject the time range into the page BEFORE injecting content.js
      chrome.scripting.executeScript(
        {
          target: { tabId: youtubeTab.id },
          func: (start, end) => {
            window.transcriptSliceRange = { start, end };
          },
          args: [request.startTime || "00:00", request.endTime || "99:59"],
        },
        () => {
          // Then inject the content script
          chrome.scripting.executeScript({
            target: { tabId: youtubeTab.id },
            files: ["content.js"],
          });
        }
      );
    });

    return true; // Keep the message channel open for async
  }

  // ✅ Step 2: Forward the transcript to the popup
  if (request.type === "TRANSCRIPT_FETCHED") {
    chrome.runtime.sendMessage({
      type: "TRANSCRIPT_READY",
      transcript: request.transcript,
    });
  }

  // ✅ Step 3: Send the transcript to ChatGPT
  if (request.type === "YOUTUBE_TRANSCRIPT") {
    console.log("📥 YOUTUBE_TRANSCRIPT received in background.js");
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
          const editor = document.querySelector('[contenteditable="true"].ProseMirror');
          if (editor) {
            editor.focus();
            document.execCommand("insertText", false, msg);
          }
        },
        args: [prompt],
      });

      chrome.runtime.sendMessage({
        type: "YOUTUBE_TRANSCRIPT_DONE",
        charCount: transcript.length,
      });
    });
  }
});
