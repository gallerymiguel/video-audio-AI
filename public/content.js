function extractPlayerResponse() {
    // Try global object first
    if (window.ytInitialPlayerResponse) {
      return window.ytInitialPlayerResponse;
    }
  
    // Fallback: scrape it from a script tag
    const scripts = Array.from(document.getElementsByTagName("script"));
    for (const script of scripts) {
      const text = script.textContent;
      if (text && text.includes("var ytInitialPlayerResponse =")) {
        const match = text.match(/var ytInitialPlayerResponse\s*=\s*(\{.*?\});/s);
        if (match && match[1]) {
          try {
            return JSON.parse(match[1]);
          } catch (err) {
            console.log("❌ JSON parse failed on fallback:", err);
          }
        }
      }
    }
  
    return null;
  }
  
  
  async function getYouTubeCaptions() {
    const playerResponse = extractPlayerResponse();
  
    if (!playerResponse) {
      return "❌ No player response found.";
    }
  
    const tracks = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks || tracks.length === 0) {
      return "❌ No captions available.";
    }
  
    const captionTrack = tracks[0];
    const fetchUrl = captionTrack.baseUrl;
  
    const res = await fetch(fetchUrl);
    const xml = await res.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, "text/xml");
    const texts = Array.from(xmlDoc.getElementsByTagName("text")).map(el =>
      el.textContent.replace(/&#39;/g, "'")
    );
    return texts.join(" ");
  }
  
  
  // Get captions, then send to background script
  getYouTubeCaptions().then((transcript) => {
    chrome.runtime.sendMessage({ type: "YOUTUBE_TRANSCRIPT", transcript });
  });
  