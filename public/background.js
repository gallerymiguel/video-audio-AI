// ✅ Clean, working background.js for your Chrome Extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // ✅ Step 1: Handle YouTube or Instagram Fetching
  if (request.type === "SEND_TO_CHATGPT") {
    console.log("🛎️ Received SEND_TO_CHATGPT message:", request);

    chrome.tabs.query({}, (tabs) => {
      // <--- query ALL tabs now
      console.log("📋 chrome.tabs.query result:", tabs);

      if (!tabs || tabs.length === 0) {
        console.log("❌ No active tabs found.");
        return;
      }

      const activeTab = tabs[0];
      console.log("🔎 Active tab object:", activeTab);

      if (!activeTab.id || !activeTab.url) {
        console.log("❌ activeTab.id or activeTab.url missing");
        return;
      }

      console.log("✅ Detected tab URL:", activeTab.url);

      const isYouTubeVideo = activeTab.url.match(
        /youtube\.com\/(watch\?v=|shorts\/)/
      );
      const isInstagram = activeTab.url.match(
        /instagram\.com\/(reels|reel|p)\//
      );

      console.log("🎯 isYouTubeVideo:", !!isYouTubeVideo);
      console.log("🎯 isInstagram:", !!isInstagram);

      if (!isYouTubeVideo && !isInstagram) {
        console.log("❌ Not a valid YouTube or Instagram page.");
        return;
      }

      if (isYouTubeVideo) {
        console.log("📺 This is a YouTube video, injecting time range...");
        chrome.scripting.executeScript(
          {
            target: { tabId: activeTab.id },
            func: (start, end) => {
              window.transcriptSliceRange = { start, end };
            },
            args: [request.startTime || "00:00", request.endTime || "99:59"],
          },
          () => {
            chrome.scripting.executeScript({
              target: { tabId: activeTab.id },
              files: ["content.js"],
            });
          }
        );
      } else if (isInstagram) {
        console.log(
          "📸 This is an Instagram Reel/Post, injecting content.js..."
        );
        chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ["content.js"],
        });
      }
    });

    return true;
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

    const selectedChatTabId = request.selectedChatTabId; // ✅ pull it from request

    if (!selectedChatTabId) {
      console.log("❌ No ChatGPT tab selected.");
      return;
    }

    const maxLength = 3000;
    const transcript = request.transcript.slice(0, maxLength);
    const prompt = `Summarize this video transcript (length: ${transcript.length} characters):\n\n${transcript}`;

    chrome.scripting.executeScript({
      target: { tabId: selectedChatTabId },
      func: (msg) => {
        const waitForEditor = () => {
          const editor = document.querySelector(
            '[contenteditable="true"].ProseMirror'
          );
          if (editor) {
            editor.focus();
            document.execCommand("insertText", false, msg);
          } else {
            setTimeout(waitForEditor, 300); // try again every 300ms until it finds it
          }
        };
        waitForEditor();
      },
      args: [prompt],
    });

    chrome.runtime.sendMessage({
      type: "YOUTUBE_TRANSCRIPT_DONE",
      charCount: transcript.length,
    });
  }
});
