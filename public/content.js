(() => {
  // Detect platform
  const isInstagramReel = window.location.href.includes("instagram.com/reels/");
  const isInstagramPost = window.location.href.includes("instagram.com/p/");
  const isInstagram = isInstagramReel || isInstagramPost;
  const isYouTube = window.location.href.includes("youtube.com");

  if (!isInstagram && !isYouTube) {
    console.log("❌ Not on a supported page (YouTube or Instagram).");
    return;
  }

  function timeToSeconds(t) {
    const parts = t.split(":").map(Number);
    return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
  }

  async function getYouTubeDescription(timeout = 5000) {
    try {
      const isShort = window.location.href.includes("/shorts/");
      console.log(
        "🔍 Checking for",
        isShort ? "Shorts title" : "Full video description"
      );

      if (isShort) {
        // 🔹 Shorts title logic
        const waitForShortsTitle = () =>
          new Promise((resolve) => {
            const interval = 100;
            let elapsed = 0;

            const check = () => {
              const titleEl = document.querySelector(
                "ytd-reel-player-overlay-renderer h2 span"
              );
              if (titleEl && titleEl.textContent.trim()) {
                return resolve(titleEl.textContent.trim());
              }

              elapsed += interval;
              if (elapsed >= timeout) return resolve("");
              setTimeout(check, interval);
            };

            check();
          });

        const title = await waitForShortsTitle();
        if (title) {
          console.log("📄 Shorts title found:", title.slice(0, 100));
          return title;
        }

        console.warn("❌ No Shorts title found.");
        return "";
      }

      // 🔹 Try expanding full description for regular videos
      const expandBtn = document.querySelector("#description-inline-expander");
      if (expandBtn) {
        expandBtn.click();
        console.log("🖱️ Clicked 'Show more'");
        await new Promise((res) => setTimeout(res, 1000));
      }

      // 🔹 Wait for and collect all visible span text
      const waitForFullDescription = () =>
        new Promise((resolve) => {
          const container = document.querySelector(
            "#description-inline-expander"
          );
          if (!container) return resolve("");

          let prevLength = 0;
          const interval = 100;
          let elapsed = 0;

          const check = () => {
            const spans = container.querySelectorAll("span");
            const text = Array.from(spans)
              .map((s) => s.textContent?.trim())
              .filter(
                (t, i, arr) =>
                  t &&
                  arr.indexOf(t) === i &&
                  !t.match(/^(Show transcript|Videos|About)$/i)
              )
              .join("\n");

            if (text.length > prevLength) {
              prevLength = text.length;
            }

            if (prevLength > 200) return resolve(text);

            elapsed += interval;
            if (elapsed >= 5000) return resolve(text || "");
            setTimeout(check, interval);
          };

          check();
        });

      const result = await waitForFullDescription();
      if (result) {
        console.log("📄 Full YouTube description:", result.slice(0, 200));
        return result;
      }

      console.warn("❌ Full YouTube description not found or too short.");
      return "";
    } catch (err) {
      console.error("❌ Error scraping YouTube description:", err);
      return "";
    }
  }

  async function getYouTubeCaptions(preferredLanguage = "en") {
    function extractPlayerResponse() {
      if (window.ytInitialPlayerResponse) return window.ytInitialPlayerResponse;

      const scripts = Array.from(document.getElementsByTagName("script"));
      for (const script of scripts) {
        const text = script.textContent;
        if (text?.includes("var ytInitialPlayerResponse =")) {
          const match = text.match(
            /var ytInitialPlayerResponse\s*=\s*(\{.*?\});/s
          );
          if (match && match[1]) {
            try {
              return JSON.parse(match[1]);
            } catch (err) {
              console.log("❌ JSON parse failed:", err);
            }
          }
        }
      }
      return null;
    }

    // This is your existing extractPlayerResponse logic
    function extractPlayerResponse() {
      if (window.ytInitialPlayerResponse) return window.ytInitialPlayerResponse;

      const scripts = Array.from(document.getElementsByTagName("script"));
      for (const script of scripts) {
        const text = script.textContent;
        if (text?.includes("var ytInitialPlayerResponse =")) {
          const match = text.match(
            /var ytInitialPlayerResponse\s*=\s*(\{.*?\});/s
          );
          if (match && match[1]) {
            try {
              return JSON.parse(match[1]);
            } catch (err) {
              console.log("❌ JSON parse failed:", err);
            }
          }
        }
      }
      return null;
    }

    function waitForPlayerResponse(timeout = 10000) {
      return new Promise((resolve, reject) => {
        const interval = 100;
        let waited = 0;

        const check = () => {
          const data = extractPlayerResponse();
          if (data) return resolve(data);

          waited += interval;
          if (waited >= timeout) return reject("❌ No player response found.");
          setTimeout(check, interval);
        };

        check();
      });
    }

    try {
      const playerResponse = await waitForPlayerResponse();
      const tracks =
        playerResponse?.captions?.playerCaptionsTracklistRenderer
          ?.captionTracks;

      if (!tracks || tracks.length === 0) return "❌ No captions available.";

      // ✅ Pull preferred language from storage
      const { preferredLanguage } = await new Promise((resolve) =>
        chrome.storage.local.get("preferredLanguage", resolve)
      );

      // Normalize strings to lowercase for reliable comparison
      const preferredLang = (preferredLanguage || "en").toLowerCase();

      let captionTrack = null;

      // 1) Auto-generated (“asr”) captions in preferred language
      captionTrack = tracks.find(
        (t) =>
          t.kind === "asr" && t.languageCode?.toLowerCase() === preferredLang
      );
      if (captionTrack) {
        console.log(
          "🔍 Found auto-generated captions for",
          preferredLang,
          captionTrack
        );
      }

      // 2) Manually uploaded captions in preferred language
      if (!captionTrack) {
        captionTrack = tracks.find(
          (t) =>
            t.languageCode?.toLowerCase() === preferredLang && t.kind !== "asr"
        );
        if (captionTrack) {
          console.log(
            "🔍 Found manual captions for",
            preferredLang,
            captionTrack
          );
        }
      }

      // 3) Legacy vssId match
      if (!captionTrack) {
        captionTrack = tracks.find((t) => t.vssId === `.${preferredLang}`);
        if (captionTrack) {
          console.log(
            "🔍 Found captions via vssId for",
            preferredLang,
            captionTrack
          );
        }
      }

      // 4) Name match (simpleText)
      if (!captionTrack) {
        captionTrack = tracks.find((t) =>
          t.name?.simpleText?.toLowerCase().includes(preferredLang)
        );
        if (captionTrack) {
          console.log(
            "🔍 Found captions by name match for",
            preferredLang,
            captionTrack
          );
        }
      }

      // 5) English manual fallback
      if (!captionTrack) {
        captionTrack = tracks.find(
          (t) => t.languageCode?.startsWith("en") && t.kind !== "asr"
        );
        if (captionTrack) {
          console.log("🔍 Fallback to manual English captions:", captionTrack);
        }
      }

      // 6) English auto-gen fallback
      if (!captionTrack) {
        captionTrack = tracks.find(
          (t) => t.languageCode?.startsWith("en") && t.kind === "asr"
        );
        if (captionTrack) {
          console.log(
            "🔍 Fallback to auto-generated English captions:",
            captionTrack
          );
        }
      }

      // 7) Last-resort: any track
      if (!captionTrack) {
        captionTrack = tracks[0];
        console.log("🔍 No preferred match—picking first track:", captionTrack);
      }

      if (!captionTrack) {
        console.warn("⚠️ Could not find any usable caption track at all.");
        return "❌ No usable captions found.";
      }

      // Finally, you have `captionTrack`—proceed to fetch its `baseUrl`
      console.log("✅ Using caption track:", captionTrack);

      const res = await fetch(captionTrack.baseUrl);
      const xml = await res.text();
      const xmlDoc = new DOMParser().parseFromString(xml, "text/xml");

      const startSec = timeToSeconds(
        window.transcriptSliceRange?.start || "00:00"
      );
      const endSec = timeToSeconds(window.transcriptSliceRange?.end || "99:59");

      const texts = Array.from(xmlDoc.getElementsByTagName("text"))
        .filter((el) => {
          const start = parseFloat(el.getAttribute("start"));
          return start >= startSec && start <= endSec;
        })
        .map((el) =>
          el.textContent
            .replace(/&#39;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
        );

      return {
        transcript: texts.join(" "),
        sourceLangCode: captionTrack.languageCode,
      };
    } catch (err) {
      console.log(err);
      return {
        transcript: "❌ Failed to fetch YouTube captions.",
        sourceLangCode: preferredLanguage || "en",
      };
    }
  }

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
        const blob = new Blob(chunks, { type: "audio/webm" });
        console.log("✅ Captured audio blob:", blob);

        console.log("🛰️ Sending audio to local server...");

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        // a.href = url;
        // a.download = "recorded_audio.webm";
        // a.click();

        const formData = new FormData();
        const file = new File([blob], "audio.webm", { type: "audio/webm" });
        formData.append("audio", file);

        window.isAudioCaptureInProgress = false;

        chrome.storage.local.get(["token"], async (result) => {
          const token = result.token;
          if (!token) {
            console.warn("⚠️ No auth token found in chrome.storage.local");
          }

          try {
            const response = await fetch("http://localhost:3000/transcribe", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`, // ✅ THIS still needs to be here
              },
              body: formData,
            });

            const data = await response.json();

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
                description: window.lastInstagramDescription || "",
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

  async function getInstagramCaptions() {
    try {
      console.log("🔍 Attempting to scrape Instagram caption...");

      const mainVideo = document.querySelector("video");
      if (!mainVideo) {
        console.log("❌ No video element found.");
        return "❌ No video found.";
      }

      let container = mainVideo.closest("article") || mainVideo.closest("div");
      if (!container) {
        console.log("❌ No container found near video.");
        return "❌ No captions found.";
      }

      const spans = Array.from(container.querySelectorAll("span"));
      let result = "";

      for (const span of spans) {
        const text = span.innerText?.trim();
        if (
          text &&
          text.length > 3 &&
          !text.startsWith("#") &&
          !text.includes("·") &&
          !text.toLowerCase().includes("original audio") &&
          !text.toLowerCase().includes("clickupcomedy")
        ) {
          result = text;
          break;
        }
      }

      if (!result) {
        console.log("❌ No clean caption found.");
        return "❌ No clean caption found.";
      }

      console.log("📝 Instagram caption found:", result);
      return result;
    } catch (err) {
      console.error("❌ Error extracting Instagram caption:", err);
      return "❌ Failed to extract Instagram caption.";
    }
  }

  // 🔥 Now smartly choose based on site:
  if (isInstagram) {
    console.log("📸 Instagram Reel or Post detected.");

    window.isInstagramScraping = true;

    Promise.all([getInstagramCaptions(), getInstagramDescription()]).then(
      ([transcript, description]) => {
        console.log(
          "🚀 Sending TRANSCRIPT_FETCHED to popup:",
          transcript.slice(0, 100)
        );
        console.log("📄 Instagram description:", description?.slice?.(0, 100));

        window.lastInstagramDescription = description;
        chrome.runtime.sendMessage({
          type: "TRANSCRIPT_FETCHED",
          transcript,
          description,
        });

        const videoEl = document.querySelector("video");
        const durationSec =
          videoEl && videoEl.duration > 0 ? Math.ceil(videoEl.duration) : 5;
        console.log(`🎙️ Capturing full Instagram audio (${durationSec}s)`);
        captureAudioFromVideo(durationSec);
      }
    );
  } else if (isYouTube) {
    console.log("🎥 YouTube Video detected.");

    function waitForVideo(timeout = 5000) {
      return new Promise((resolve, reject) => {
        const interval = 100;
        let waited = 0;

        const check = () => {
          const video = document.querySelector("video");
          if (video) return resolve(video);

          waited += interval;
          if (waited >= timeout) return reject("❌ No <video> element found.");
          setTimeout(check, interval);
        };

        check();
      });
    }

    waitForVideo()
      .then((video) => {
        video.play();
        setTimeout(() => {
          video.pause();
          chrome.storage.local.get(
            "preferredLanguage",
            ({ preferredLanguage }) => {
              Promise.all([
                getYouTubeCaptions(preferredLanguage || "en"),
                getYouTubeDescription(),
              ]).then(([captionData, description]) => {
                const { transcript, sourceLangCode } = captionData;

                console.log("🔁 caption result:", {
                  transcript,
                  sourceLangCode,
                });
                console.log(
                  "📄 YouTube description:",
                  description?.slice?.(0, 100)
                );

                chrome.runtime.sendMessage({
                  type: "TRANSCRIPT_FETCHED",
                  transcript,
                  description,
                  language: preferredLanguage || "en",
                  sourceLangCode,
                });
              });
            }
          );
        }, 3000);
      })
      .catch((err) => {
        console.log(err);
        chrome.storage.local.get(
          "preferredLanguage",
          ({ preferredLanguage }) => {
            getYouTubeCaptions(preferredLanguage || "en").then(
              ({ transcript, sourceLangCode }) => {
                console.log("🔁 caption result (no description):", {
                  transcript,
                  sourceLangCode,
                });
                chrome.runtime.sendMessage({
                  type: "TRANSCRIPT_FETCHED",
                  transcript,
                  description: "", // ✅ Safe fallback
                  language: preferredLanguage || "en",
                  sourceLangCode,
                });
              }
            );
          }
        );
      });
  }
})();
