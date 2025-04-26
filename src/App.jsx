import { useState, useEffect } from "react";

const styleTag = document.createElement("style");
styleTag.textContent = `
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}`;
document.head.appendChild(styleTag);

function parseTimeToSeconds(str) {
  if (!str || typeof str !== "string") return null;
  const match = str.match(/^(\d+):(\d{2})$/);
  if (!match) return null;

  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  if (isNaN(minutes) || isNaN(seconds)) return null;

  return minutes * 60 + seconds;
}

const fadeStyleTag = document.createElement("style");
fadeStyleTag.textContent = `
.fade-in-out {
  opacity: 0;
  transition: opacity 0.5s ease-in-out;
}
.fade-in-out.show {
  opacity: 1;
}
`;
document.head.appendChild(fadeStyleTag);

function App() {
  const [chatTabs, setChatTabs] = useState([]);
  const [selectedTabId, setSelectedTabId] = useState(null);
  const [status, setStatus] = useState("");
  const [charCount, setCharCount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("00:00");
  const [rawTranscript, setRawTranscript] = useState("");
  const [timestampError, setTimestampError] = useState("");
  const [videoDuration, setVideoDuration] = useState(null);
  const [sliderStart, setSliderStart] = useState(0);
  const [sliderEnd, setSliderEnd] = useState(0);
  const [lastUsedStart, setLastUsedStart] = useState(null);
  const [lastUsedEnd, setLastUsedEnd] = useState(null);
  // right here last
  const [waitingForVideo, setWaitingForVideo] = useState(false);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) return;

      // Try repeatedly for up to 1.5s until video is ready
      const tryGetDuration = (attempt = 0) => {
        setWaitingForVideo(true); // 🟡 START waiting when trying to fetch

        chrome.scripting.executeScript(
          {
            target: { tabId },
            func: () => {
              const video = document.querySelector("video");
              return video?.duration || null;
            },
          },
          (results) => {
            const durationSec = results?.[0]?.result;
            if (typeof durationSec === "number" && durationSec > 0) {
              const duration = Math.floor(durationSec);
              const formattedEnd = `${Math.floor(duration / 60)}:${String(
                duration % 60
              ).padStart(2, "0")}`;

              console.log("🎥 Video duration ready:", durationSec);
              setVideoDuration(duration);
              setSliderStart(0);
              setSliderEnd(duration);
              setStartTime("00:00");
              setEndTime(formattedEnd);

              setWaitingForVideo(false); // 🟢 STOP waiting after successful fetch
            } else if (attempt < 35) {
              setTimeout(() => tryGetDuration(attempt + 1), 150);
            } else {
              console.warn("❌ Could not fetch video duration after retries.");
              setWaitingForVideo(false); // 🛑 Also stop waiting if totally fail
              setVideoError(true); // 🔥 Set the error flag
            }
          }
        );
      };

      tryGetDuration();
    });
  }, []);

  useEffect(() => {
    const listener = (message, sender, sendResponse) => {
      if (message.type === "TRANSCRIPT_READY") {
        if (typeof message.transcript === "string") {
          console.log(
            "✅ Transcript received:",
            message.transcript.length,
            "chars"
          );
          clearTimeout(window._transcriptTimeout);
          setLoading(false);
          setRawTranscript(message.transcript);
          setCharCount(message.transcript.length);

          if (message.transcript.length > 3000) {
            setStatus("⚠️ Transcript too long! Try reducing time range.");
          } else {
            setStatus("✅ Transcript fetched! Ready to send.");
          }
        } else {
          console.log("❌ Invalid transcript received:", message.transcript);
          setStatus("❌ Failed to fetch transcript.");
          setLoading(false);
        }
      }

      if (message.type === "YOUTUBE_TRANSCRIPT_DONE") {
        console.log("✅ Final send complete, char count:", message.charCount);
        setLoading(false);
        setStatus("✅ Transcript sent to ChatGPT!");
        setTimeout(() => setStatus(""), 4000);

        if (typeof message.charCount === "number") {
          setCharCount(message.charCount);
        }

        chrome.tabs.query({}, (tabs) => {
          const matches = tabs.filter(
            (tab) => tab.url && tab.url.includes("chatgpt.com")
          );
          setChatTabs(matches);
        });
      }
    };

    chrome.runtime.onMessage.addListener(listener);

    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  // Load ChatGPT tabs + previously selected tab on popup open
  useEffect(() => {
    chrome.tabs.query({}, (tabs) => {
      const matches = tabs.filter(
        (tab) => tab.url && tab.url.includes("chatgpt.com")
      );
      setChatTabs(matches);
    });

    chrome.storage.local.get("selectedChatTabId", ({ selectedChatTabId }) => {
      if (selectedChatTabId) {
        setSelectedTabId(selectedChatTabId);
      }
    });
  }, []);

  useEffect(() => {
    const newStart = parseTimeToSeconds(startTime);
    if (
      newStart !== null &&
      newStart !== sliderStart &&
      newStart < videoDuration
    ) {
      setSliderStart(newStart);
    }

    const newEnd = parseTimeToSeconds(endTime);
    if (newEnd !== null && newEnd !== sliderEnd && newEnd <= videoDuration) {
      setSliderEnd(newEnd);
    }
  }, [startTime, endTime, videoDuration]);

  // Fetch ChatGPT tabs and selected tab ID
  const handleSelect = (tabId) => {
    setSelectedTabId(tabId);
    if (chrome?.storage?.local) {
      chrome.storage.local.set({ selectedChatTabId: tabId });
    }
  };

  // Send message to ChatGPT tab
  const handleSend = () => {
    setStatus("Fetching transcript...");
    setLoading(true);

    // Timeout fallback
    window._transcriptTimeout = setTimeout(() => {
      setLoading(false);
      setStatus(
        "❌ No response. Try refreshing YouTube or re-selecting a tab."
      );
    }, 10000);

    // Format validation: mm:ss or m:ss
    const isValidTime = (str) => /^(\d{1,2}):([0-5]?\d)$/.test(str);
    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      setTimestampError("❌ Please enter timestamps in mm:ss format.");
      setLoading(false);
      return;
    }

    // Convert time to seconds
    const timeToSeconds = (t) => {
      const [min, sec] = t.split(":").map(Number);
      return min * 60 + sec;
    };

    let start = timeToSeconds(startTime);
    let end = timeToSeconds(endTime);

    // ✅ If both are "00:00", treat it as "get full video"

    if (start >= end) {
      setTimestampError("❌ Start time must be before end time.");
      setLoading(false);
      return;
    }

    // Get video duration from the active YouTube tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) {
        setTimestampError("❌ Could not find active YouTube tab.");
        setLoading(false);
        return;
      }

      chrome.scripting.executeScript(
        {
          target: { tabId },
          func: () => {
            const video = document.querySelector("video");
            return video ? video.duration : null;
          },
        },
        (results) => {
          const durationSec = results?.[0]?.result;
          // ✅ Treat 00:00 to 00:00 as "full video"
          if (start > durationSec || end > durationSec) {
            setTimestampError(
              "❌ One or both timestamps exceed the video length."
            );
            setLoading(false);
            return;
          }

          if (typeof durationSec === "number") {
            const duration = Math.floor(durationSec);
            const formattedEnd = `${Math.floor(duration / 60)}:${String(
              duration % 60
            ).padStart(2, "0")}`;

            console.log("🎥 Video duration fetched:", durationSec);
            console.log("🕒 Setting endTime to:", formattedEnd);

            setVideoDuration(duration);
            setSliderStart(0);
            setSliderEnd(duration);
            setStartTime("00:00");
            setEndTime(formattedEnd);

            console.log("✅ endTime state now:", formattedEnd);
          }

          if (start > durationSec || end > durationSec) {
            setTimestampError(
              "❌ One or both timestamps exceed the video length."
            );
            setLoading(false);
            return;
          }
          // ✅ Store video data and update sliders
          setSliderStart(0);
          setSliderEnd(Math.floor(durationSec));
          setVideoDuration(durationSec);

          setTimestampError(""); // ✅ Clear errors if all is good

          // ✅ Finally send to background script
          console.log("📤 Sending SEND_TO_CHATGPT from Convert button");
          setLastUsedStart(startTime);
          setLastUsedEnd(endTime);
          chrome.runtime.sendMessage({
            type: "SEND_TO_CHATGPT",
            startTime,
            endTime,
            selectedChatTabId: selectedTabId,
          });
        }
      );
    });
  };

  return (
    <div style={{ padding: "10px" }}>
      <div className={`fade-in-out ${videoError ? "show" : ""}`}>
        {videoError && (
          <p
            style={{
              fontSize: "12px",
              color: "red",
              fontWeight: "bold",
              textAlign: "center",
              marginBottom: "10px",
            }}
          >
            ❌ Couldn't detect video. Please refresh the YouTube page and try
            again.
          </p>
        )}
      </div>

      <h4>Select ChatGPT Tab</h4>
      <div className={`fade-in-out ${waitingForVideo ? "show" : ""}`}>
        {waitingForVideo && (
          <p
            style={{
              fontSize: "12px",
              color: "#666",
              marginBottom: "10px",
              textAlign: "center",
            }}
          >
            ⏳ Waiting for video to load...
          </p>
        )}
      </div>

      {chatTabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => handleSelect(tab.id)}
          style={{
            width: "100%",
            padding: "8px",
            marginBottom: "6px",
            backgroundColor: selectedTabId === tab.id ? "#4caf50" : "#f0f0f0",
            color: selectedTabId === tab.id ? "white" : "black",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          {tab.title}
        </button>
      ))}
      {status && (
        <p style={{ marginBottom: "10px", fontWeight: "bold" }}>{status}</p>
      )}
      {loading && (
        <div style={{ marginBottom: "10px", textAlign: "center" }}>
          <div
            className="loader"
            style={{
              width: "24px",
              height: "24px",
              border: "4px solid #ccc",
              borderTop: "4px solid #4caf50",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto",
            }}
          ></div>
          <p style={{ fontSize: "12px", marginTop: "4px" }}>
            Fetching transcript…
          </p>
        </div>
      )}
      <div style={{ marginBottom: "10px" }}>
        <label>
          Start Time (mm:ss):
          <input
            type="text"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            placeholder="e.g., 02:15"
            style={{ width: "80px", marginLeft: "10px" }}
          />
        </label>
      </div>

      <div style={{ marginBottom: "10px" }}>
        <label>
          End Time (mm:ss):
          <input
            type="text"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            placeholder="e.g., 05:45"
            style={{ width: "80px", marginLeft: "14px" }}
          />
        </label>
      </div>

      {videoDuration && (
        <div style={{ margin: "10px 0" }}>
          <p style={{ fontSize: "12px" }}>
            Start: {Math.floor(sliderStart / 60)}:
            {String(sliderStart % 60).padStart(2, "0")}
            {"  "}→{"  "}
            End: {Math.floor(sliderEnd / 60)}:
            {String(sliderEnd % 60).padStart(2, "0")}
          </p>
          <input
            type="range"
            min={0}
            max={Math.floor(videoDuration)}
            value={sliderStart}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (val < sliderEnd) {
                setSliderStart(val);
                setStartTime(
                  `${Math.floor(val / 60)}:${String(val % 60).padStart(2, "0")}`
                );
              }
            }}
          />
          <input
            type="range"
            min={0}
            max={Math.floor(videoDuration)}
            value={sliderEnd}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (val > sliderStart) {
                setSliderEnd(val);
                setEndTime(
                  `${Math.floor(val / 60)}:${String(val % 60).padStart(2, "0")}`
                );
              }
            }}
          />
        </div>
      )}

      {typeof rawTranscript === "string" && rawTranscript.length > 0 && (
        <div style={{ marginTop: "10px", marginBottom: "10px" }}>
          <p
            style={{
              fontSize: "12px",
              marginBottom: "2px",
              color: charCount > 3000 ? "red" : "#666",
              fontWeight: charCount > 3000 ? "bold" : "normal",
            }}
          >
            Transcript length: {charCount} characters
          </p>
        </div>
      )}

      {timestampError && (
        <p
          style={{
            color: "red",
            fontSize: "12px",
            marginTop: "-6px",
            marginBottom: "10px",
          }}
        >
          {timestampError}
        </p>
      )}

      <button onClick={handleSend} style={{ marginTop: "10px" }}>
        Convert YouTube Transcript
      </button>
      <p style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}>
        This will fetch the transcript based on your selected time range.
      </p>

      {rawTranscript.length > 0 && (
        <>
          {lastUsedStart && lastUsedEnd && (
            <p style={{ fontSize: "12px", marginBottom: "6px", color: "#555" }}>
              From {lastUsedStart} to {lastUsedEnd}
            </p>
          )}

          <button
            disabled={!rawTranscript || rawTranscript.startsWith("❌")}
            onClick={() => {
              chrome.runtime.sendMessage({
                type: "YOUTUBE_TRANSCRIPT",
                transcript: rawTranscript,
                selectedChatTabId: selectedTabId, // 🛠 ADD THIS
              });

              setStatus("Sending to ChatGPT...");
              setLoading(true);
            }}
            style={{
              backgroundColor: "#4caf50",
              color: "white",
              border: "none",
              borderRadius: "5px",
              padding: "6px",
              fontWeight: "bold",
              width: "100%",
              marginBottom: "10px",
            }}
          >
            Send to ChatGPT
          </button>
        </>
      )}
    </div>
  );
}

export default App;
