(() => {
  if (!window.transcriptSliceRange) {
    console.log("❌ transcriptSliceRange not set. Aborting.");
    return;
  }

  function timeToSeconds(t) {
    const parts = t.split(":").map(Number);
    return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
  }

  function extractPlayerResponse() {
    if (window.ytInitialPlayerResponse) return window.ytInitialPlayerResponse;

    const scripts = Array.from(document.getElementsByTagName("script"));
    for (const script of scripts) {
      const text = script.textContent;
      if (text?.includes("var ytInitialPlayerResponse =")) {
        const match = text.match(/var ytInitialPlayerResponse\s*=\s*(\{.*?\});/s);
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

  async function getYouTubeCaptions() {
    try {
      const playerResponse = await waitForPlayerResponse();
      const tracks = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks;

      if (!tracks || tracks.length === 0) return "❌ No captions available.";

      const captionTrack = tracks[0];
      const res = await fetch(captionTrack.baseUrl);
      const xml = await res.text();
      const xmlDoc = new DOMParser().parseFromString(xml, "text/xml");

      const startSec = timeToSeconds(window.transcriptSliceRange?.start || "00:00");
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

  const video = document.querySelector("video");

  if (video) {
    video.play();
    setTimeout(() => {
      video.pause();
      getYouTubeCaptions().then((transcript) => {
        chrome.runtime.sendMessage({
          type: "TRANSCRIPT_FETCHED", // ✅ NOT YOUTUBE_TRANSCRIPT
          transcript,
        });
      });
    }, 3000);
  } else {
    getYouTubeCaptions().then((transcript) => {
      chrome.runtime.sendMessage({
        type: "TRANSCRIPT_FETCHED",
        transcript,
      });
    });
  }
})();
