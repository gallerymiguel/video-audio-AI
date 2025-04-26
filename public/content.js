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

  // 🔥 Now smartly choose based on site:
  if (isInstagram) {
    console.log("📸 Instagram Reel or Post detected.");
    getInstagramCaptions().then((transcript) => {
      console.log(
        "🚀 Sending TRANSCRIPT_FETCHED to popup:",
        transcript.slice(0, 100)
      );
      chrome.runtime.sendMessage({ type: "TRANSCRIPT_FETCHED", transcript }); // Send the transcript to the background script
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
