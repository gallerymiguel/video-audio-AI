(() => {
  // Detect platform
  const isInstagramReel = window.location.href.includes("instagram.com/reels/");
  const isInstagramPost = window.location.href.includes("instagram.com/p/");
  const isInstagram = isInstagramReel || isInstagramPost;

  let CONFIG = null;

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data.type === "CONFIG_DATA") {
      CONFIG = event.data.payload;
      // console.log("✅ Config received in content.js:", CONFIG);
    }
  });

  if (!isInstagram) {
    console.log("❌ Not on a supported page (YouTube or Instagram).");
    return;
  }
  // Inject config.js
  const configScript = document.createElement("script");
  configScript.src = chrome.runtime.getURL("config.js");
  document.documentElement.appendChild(configScript);

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "SET_TRANSCRIPT_RANGE") {
      window.transcriptSliceRange = {
        start: message.startTime,
        end: message.endTime,
      };
      console.log(
        "✅ transcriptSliceRange set via message:",
        window.transcriptSliceRange
      );
    }
  });

  async function captureAudioFromVideo(durationSeconds = 5) {
    if (window.isAudioCaptureInProgress) {
      console.log("⚡ Already capturing audio — ignoring new request.");
      return;
    }

    window.isAudioCaptureInProgress = true;

    try {
      console.log("🎙️ Starting to capture audio from video...");

      const video = document.querySelector("video");
      if (!video) {
        console.log("❌ No video element found for recording.");
        return;
      }

      // ⏪ Start from 0
      video.currentTime = 0;

      // ⏸ Ensure it's paused before recording
      video.pause();

      const stream = video.captureStream();
      const audioTracks = stream.getAudioTracks();
      if (!audioTracks.length) {
        console.log("❌ No audio tracks available in stream.");
        return;
      }

      const mediaRecorder = new MediaRecorder(stream);
      const chunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const fullBlob = new Blob(chunks, { type: "video/webm" });
        console.log("✅ Captured full video/audio blob:", fullBlob);

        // Send the sliced blob to Whisper server
        const formData = new FormData();
        const file = new File([fullBlob], "fullVideo.webm", {
          type: "video/mp4",
        });
        formData.append("audio", file); // reuse "audio" key for consistency

        // Add startTime and endTime to formData (from window.transcriptSliceRange)
        if (window.transcriptSliceRange) {
          formData.append("startTime", window.transcriptSliceRange.start);
          formData.append("endTime", window.transcriptSliceRange.end);
        }

        window.isAudioCaptureInProgress = false;

        chrome.storage.local.get(["token"], async (result) => {
          const token = result.token;
          if (!token) {
            console.warn("⚠️ No auth token found in chrome.storage.local");
          }

          const whisperUrl = CONFIG?.WHISPER_SERVER_URL;

          if (!whisperUrl) {
            console.error("❌ WHISPER_SERVER_URL not loaded from config.js");
            return;
          }

          try {
            const response = await fetch(`${whisperUrl}/transcribe`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
              },
              body: formData,
            });

            const data = await response.json();

            const description = await getInstagramDescription();
            console.log("📝 Scraped Instagram description:", description);

            if (data && data.transcript) {
              window.isInstagramScraping = false;

              console.log(
                "✅ Transcription from server:",
                data.transcript.slice(0, 100),
                "..."
              );
              console.log(
                "🧮 Estimated token count from server:",
                data.estimatedTokens
              );
              chrome.runtime.sendMessage({
                type: "USAGE_UPDATED",
                estimatedTokenCount: data.estimatedTokens,
              });
              chrome.runtime.sendMessage({
                type: "TRANSCRIPT_FETCHED",
                transcript: data.transcript,
                description: description || "",
              });
            } else {
              console.error("❌ Failed to get text from server:", data);
              chrome.runtime.sendMessage({
                type: "TRANSCRIPT_FETCHED",
                transcript: "❌ Failed to get text from server.",
              });
            }
          } catch (error) {
            console.error("❌ Error during fetch:", error);
            chrome.runtime.sendMessage({
              type: "TRANSCRIPT_FETCHED",
              transcript: "❌ Error during transcription request.",
            });
          }
        });
      };

      // ▶️ Start recording first...
      mediaRecorder.start();
      console.log("▶️ Recording started...");

      // 🎬 Then play the video immediately from start
      video.play();

      setTimeout(() => {
        console.log("⏳ Waiting extra 1 second before stopping recording...");
        setTimeout(() => {
          mediaRecorder.stop();
          console.log(
            "⏹️ Recording stopped after",
            durationSeconds + 1,
            "seconds"
          );
        }, 1000);
      }, durationSeconds * 1000);
    } catch (err) {
      console.error("❌ Error during audio capture:", err);
    }
  }

  async function getInstagramDescription() {
    try {
      console.log("🔍 Attempting to scrape Instagram description...");

      // 1. First try h1 (commonly used in Reels)
      const h1 = document.querySelector("h1");
      if (h1 && h1.textContent.trim().length > 10) {
        const h1Text = h1.textContent.trim();
        console.log("📄 <h1> description found:", h1Text.slice(0, 100));
        return h1Text;
      }

      // 2. Fallback: scan all spans on the page and filter intelligently
      const candidates = Array.from(document.querySelectorAll("span"))
        .map((el) => el.textContent?.trim())
        .filter(
          (text) =>
            text &&
            text.length > 10 &&
            !text.startsWith("@") &&
            !text.startsWith("#") &&
            !text.toLowerCase().includes("likes") &&
            !text.toLowerCase().includes("audio") &&
            !text.toLowerCase().includes("view all") &&
            !text.toLowerCase().includes("see more")
        );

      if (candidates.length > 0) {
        const best = candidates[0];
        console.log(
          "📄 Fallback <span> description found:",
          best.slice(0, 100)
        );
        return best;
      }

      console.log("❌ No usable Instagram description found.");
      return "❌ No usable Instagram description found.";
    } catch (err) {
      console.error("❌ Error scraping Instagram description:", err);
      return "❌ Error scraping Instagram description.";
    }
  }

  if (isInstagram) {
    console.log("📸 Instagram Reel or Post detected.");

    window.isInstagramScraping = true;

    const videoEl = document.querySelector("video");
    const fallbackDuration =
      videoEl && videoEl.duration > 0 ? Math.ceil(videoEl.duration) : 5;

    const waitForRange = () => {
      if (
        window.transcriptSliceRange?.start &&
        window.transcriptSliceRange?.end
      ) {
        console.log(
          "✅ transcriptSliceRange found:",
          window.transcriptSliceRange
        );
        captureAudioFromVideo(fallbackDuration); // Now capture!
      } else {
        console.log("⏳ Waiting for transcriptSliceRange to be injected...");
        setTimeout(waitForRange, 100);
      }
    };

    waitForRange();
  } else {
    console.log("📺 Wrong site.");
  }
})();
