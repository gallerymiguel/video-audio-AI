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

  async function getYouTubeCaptions() {
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
        playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks;

      if (!tracks || tracks.length === 0) return "❌ No captions available.";

      const captionTrack = tracks[0];
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
        .map((el) => el.textContent.replace(/&#39;/g, "'"));

      return texts.join(" ");
    } catch (err) {
      console.log(err);
      return err;
    }
  }

  async function getInstagramCaptions() {
    try {
      console.log("🔍 Attempting to scrape Instagram caption...");

      // First, find the main Reel video container
      const mainVideo = document.querySelector("video");

      if (!mainVideo) {
        console.log("❌ No video element found on the page.");
        return "❌ No video found.";
      }

      // Walk up to find the closest parent that holds text
      let container = mainVideo.closest("article") || mainVideo.closest("div");

      if (!container) {
        console.log("❌ No container found near video.");
        return "❌ No captions found.";
      }

      // Now find span elements inside the container
      const spanElements = container.querySelectorAll("span");

      let captions = [];
      spanElements.forEach((span) => {
        const text = span.innerText?.trim();
        if (text && text.length > 0 && !text.startsWith("#")) {
          captions.push(text);
        }
      });

      if (captions.length === 0) {
        console.log("❌ No caption spans found inside container.");
        return "❌ No captions found.";
      }

      const finalCaption = captions.join(" ");

      // 🔥 New simple cleanup step:
      const cleanedCaption = finalCaption
        .split(/\s+/)
        .filter(
          (word) =>
            word.length > 3 &&
            !word.includes("likes") &&
            !word.includes("Reply") &&
            !word.includes("audio")
        )
        .join(" ");

      console.log("📝 Cleaned caption:", cleanedCaption.slice(0, 150), "...");
      return cleanedCaption;
    } catch (err) {
      console.error("❌ Error extracting Instagram caption:", err);
      return "❌ Failed to extract Instagram caption.";
    }
  }
  async function captureAudioFromVideo(durationSeconds = 5) {
    try {
      console.log("🎙️ Starting to capture audio from video...");

      const video = document.querySelector("video");
      if (!video) {
        console.log("❌ No video element found for recording.");
        return;
      }

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

        const formData = new FormData();
        const file = new File([blob], "audio.webm", { type: "audio/webm" });
        formData.append("audio", file);

        try {
          const response = await fetch("http://localhost:3000/transcribe", {
            method: "POST",
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

            chrome.runtime.sendMessage({
              type: "TRANSCRIPT_FETCHED",
              transcript: data.transcript, // 🛠️ Send real text to popup
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
      };

      mediaRecorder.start();
      console.log("▶️ Recording started...");

      setTimeout(() => {
        mediaRecorder.stop();
        console.log("⏹️ Recording stopped after", durationSeconds, "seconds");
      }, durationSeconds * 1000);
    } catch (err) {
      console.error("❌ Error during audio capture:", err);
    }
  }

  // 🔥 Now smartly choose based on site:
  if (isInstagram) {
    console.log("📸 Instagram Reel or Post detected.");
    
    window.isInstagramScraping = true;

    getInstagramCaptions().then((transcript) => {
      console.log(
        "🚀 Sending TRANSCRIPT_FETCHED to popup:",
        transcript.slice(0, 100)
      );
      chrome.runtime.sendMessage({ type: "TRANSCRIPT_FETCHED", transcript });

      // 🆕 After sending the transcript, also capture audio
      captureAudioFromVideo(5); // 5 seconds for now
    });
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
          getYouTubeCaptions().then((transcript) => {
            chrome.runtime.sendMessage({
              type: "TRANSCRIPT_FETCHED",
              transcript,
            });
          });
        }, 3000);
      })
      .catch((err) => {
        console.log(err);
        getYouTubeCaptions().then((transcript) => {
          chrome.runtime.sendMessage({
            type: "TRANSCRIPT_FETCHED",
            transcript,
          });
        });
      });
  }
})();
