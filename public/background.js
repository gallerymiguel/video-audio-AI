// ✅ Clean, working background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "SEND_TO_CHATGPT") {
    console.log("🛎️ Received SEND_TO_CHATGPT message:", request);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        console.log("❌ No active tabs found.");
        return;
      }

      const activeTab = tabs[0];
      if (!activeTab.id || !activeTab.url) {
        console.log("❌ activeTab.id or activeTab.url missing");
        return;
      }

      const isYouTubeVideo = activeTab.url.match(
        /youtube\.com\/(watch\?v=|shorts\/)/
      );
      const isInstagram = activeTab.url.match(
        /instagram\.com\/(reels|reel|p)\//
      );

      if (!isYouTubeVideo && !isInstagram) {
        console.log("❌ Not a valid YouTube or Instagram page.");
        return;
      }

      if (isYouTubeVideo) {
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
        chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ["content.js"],
        });
      }
    });

    return true;
  }

  // ✅ After fetching, forward to popup to show "Send to ChatGPT" button
  if (request.type === "TRANSCRIPT_FETCHED") {
    console.log("📥 TRANSCRIPT_FETCHED received...");

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs?.[0];

      chrome.scripting.executeScript(
        {
          target: { tabId: activeTab.id },
          func: () => ({
            isAudioCaptureInProgress: window.isAudioCaptureInProgress,
            isInstagramScraping: window.isInstagramScraping,
          }),
        },
        (results) => {
          const flags = results?.[0]?.result;

          if (!flags) {
            console.log("❌ Failed to get flags from tab.");
            return;
          }

          const { isAudioCaptureInProgress, isInstagramScraping } = flags;

          if (isInstagramScraping) {
            console.log(
              "⚡ Detected Instagram scraping, ignoring early caption."
            );
            return;
          }

          if (isAudioCaptureInProgress) {
            console.log("⚡ Still recording audio, ignoring transcript.");
            return;
          }

          console.log("✅ Final transcript ready, sending to popup.");
          chrome.runtime.sendMessage({
            type: "TRANSCRIPT_READY",
            transcript: request.transcript,
          });
        }
      );
    });
  }

  if (request.type === "SEND_TRANSCRIPT_TO_CHATGPT") {
    console.log("📤 SEND_TRANSCRIPT_TO_CHATGPT received");

    const selectedChatTabId = request.selectedChatTabId;
    if (!selectedChatTabId) {
      console.log("❌ No ChatGPT tab selected.");
      return;
    }

    const maxLength = 3000;
    const transcript = request.transcript.slice(0, maxLength);
    const prompt = `Summarize this video or audio transcript (length: ${transcript.length} characters):\n\n${transcript}`;

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
            setTimeout(waitForEditor, 300);
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
