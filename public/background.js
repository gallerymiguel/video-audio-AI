// background.js

// Keep track of the last caption language we fetched
let lastSourceLangCode = "en";
let lastVideoDescription = "";

chrome.runtime.onMessage.addListener((request, sender) => {
  if (request.type === "SEND_TO_CHATGPT") {

    const { contentTabId } = request;
    if (!contentTabId) {
      console.error("❌ No contentTabId provided.");
      return;
    }

    // Get the URL of the content tab explicitly
    chrome.tabs.get(contentTabId, (tab) => {
      if (chrome.runtime.lastError || !tab?.url) {
        console.error(
          "❌ Could not retrieve content tab:",
          chrome.runtime.lastError
        );
        return;
      }

      const url = tab.url;
      const isInstagram = !!url.match(/instagram\.com\/(reels|reel|p)\//);

      if (!isInstagram) {
        return;
      }

      // Inject the start and end timestamps BEFORE injecting content.js
      chrome.scripting.executeScript(
        {
          target: { tabId: contentTabId },
          func: (start, end) => {
            window.transcriptSliceRange = {
              start,
              end,
            };
          },
          args: [request.startTime, request.endTime],
        },
        () => {
          // Now inject content.js AFTER timestamps are set
          chrome.scripting.executeScript({
            target: { tabId: contentTabId },
            files: ["content.js"],
          });
        }
      );
    });

    return;
  }

  // ─── 2) TRANSCRIPT_FETCHED branch ────────────────────────────
  if (request.type === "TRANSCRIPT_FETCHED") {
    lastVideoDescription = request.description || "";
    console.log("📥 TRANSCRIPT_FETCHED received...");

    const tabId = sender.tab?.id;
    if (!tabId) {
      console.error("❌ sender.tab.id missing in TRANSCRIPT_FETCHED handler.");
      return;
    }

    chrome.scripting.executeScript(
      {
        target: { tabId },
        func: () => ({
          isAudioCaptureInProgress: window.isAudioCaptureInProgress,
          isInstagramScraping: window.isInstagramScraping,
        }),
      },
      (results) => {
        const flags = results?.[0]?.result;
        if (!flags) {
          console.warn("❌ Failed to get flags from tab.");
          return;
        }

        const { isAudioCaptureInProgress, isInstagramScraping } = flags;
        if (isInstagramScraping) {
          return;
        }
        if (isAudioCaptureInProgress) {
          return;
        }

        // Store the actual caption language for next step
        lastSourceLangCode =
          request.sourceLangCode || request.language || lastSourceLangCode;

        chrome.runtime.sendMessage({
          type: "TRANSCRIPT_READY",
          transcript: request.transcript,
          description: lastVideoDescription,
        });
      }
    );

    return;
  }

  // ─── 3) SEND_TRANSCRIPT_TO_CHATGPT branch ───────────────────
  if (request.type === "SEND_TRANSCRIPT_TO_CHATGPT") {

    // 1) Pull out the needed data
    const {
      transcript,
      selectedChatTabId,
      language: targetLangCode = "en",
      includeDescription = false,
      description,
    } = request;

    if (includeDescription && description) {
      lastVideoDescription = description; // ✅ update internal variable
    }
    if (!selectedChatTabId) {
      console.error("❌ No ChatGPT tab selected.");
      return;
    }

    // 2) Map language codes to English names
    const languageNameMap = {
      en: "English",
      es: "Spanish",
      fr: "French",
      de: "German",
      ja: "Japanese",
      ko: "Korean",
    };

    // 3) “Just summarize” prompts
    const summaryPrompts = {
      en: (t) =>
        `Summarize this video or audio transcript (length: ${t.length} characters):\n\n${t}`,
      es: (t) =>
        `Resume esta transcripción de video o audio (longitud: ${t.length} caracteres):\n\n${t}`,
      fr: (t) =>
        `Résumez cette transcription vidéo ou audio (longueur : ${t.length} caractères) :\n\n${t}`,
      de: (t) =>
        `Fasse eine Zusammenfassung dieses Video- bzw. Audiotranskripts (Länge: ${t.length} Zeichen):\n\n${t}`,
      ja: (t) =>
        `このビデオ/オーディオの文字起こしを要約してください（文字数: ${t.length}文字）：\n\n${t}`,
      ko: (t) =>
        `이 비디오 또는 오디오 전사를 요약하세요(길이: ${t.length}자):\n\n${t}`,
    };

    // 4) “Translate & summarize” prompts
    const translatePrompts = {
      en: (t, src) =>
        `This video is in ${src}. Translate the transcript and summarize it:\n\n${t}`,
      es: (t, src) =>
        `Este video está en ${src} (longitud: ${t.length} caracteres). Tradúcelo al español y resúmelo:\n\n${t}`,
      fr: (t, src) =>
        `Cette vidéo est en ${src} (longueur : ${t.length} caractères). Traduisez-la en français et résumez-la :\n\n${t}`,
      de: (t, src) =>
        `Dieses Video ist in ${src} (Länge: ${t.length} Zeichen). Übersetze es ins Deutsche und fasse es zusammen:\n\n${t}`,
      ja: (t, src) =>
        `このビデオは${src}です（文字数: ${t.length}文字）。日本語に翻訳して要約してください：\n\n${t}`,
      ko: (t, src) =>
        `이 비디오는 ${src}로 되어 있습니다(길이: ${t.length}자). 한국어로 번역하고 요약하세요:\n\n${t}`,
    };

    // 5) Choose prompt based on source vs target
    const sourceLangCode = lastSourceLangCode;
    const finalDescription = description || lastVideoDescription;

    let prompt;
    let finalTranscript = transcript;
    if (includeDescription && finalDescription) {
      finalTranscript += `\n\n[DESCRIPTION]\n${finalDescription}`;
    }

    if (sourceLangCode === targetLangCode) {
      prompt = (summaryPrompts[targetLangCode] || summaryPrompts.en)(
        finalTranscript
      );
    } else {
      const srcName = languageNameMap[sourceLangCode] || sourceLangCode;
      prompt = (translatePrompts[targetLangCode] || translatePrompts.en)(
        finalTranscript,
        srcName
      );
    }

    // 6) Inject prompt into ChatGPT tab
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

    // 7) Let popup know we’re done
    chrome.runtime.sendMessage({
      type: "YOUTUBE_TRANSCRIPT_DONE",
      charCount: finalTranscript.length,
    });
    
    return;
  }
});
