import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  setStatus,
  setLoading,
  setTranscript,
  clearTranscript,
} from "./transcriptSlice";

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
  const dispatch = useDispatch();
  const status = useSelector((state) => state.transcript.status);
  const loading = useSelector((state) => state.transcript.loading);
  const rawTranscript = useSelector((state) => state.transcript.transcript);
  const charCount = useSelector((state) => state.transcript.charCount);

  const [chatTabs, setChatTabs] = useState([]);
  const [selectedTabId, setSelectedTabId] = useState(null);
  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("00:00");
  const [timestampError, setTimestampError] = useState("");
  const [videoDuration, setVideoDuration] = useState(null);
  const [sliderStart, setSliderStart] = useState(0);
  const [sliderEnd, setSliderEnd] = useState(0);
  const [lastUsedStart, setLastUsedStart] = useState(null);
  const [lastUsedEnd, setLastUsedEnd] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [waitingForVideo, setWaitingForVideo] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("en");

  useEffect(() => {
    chrome.storage.local.get("preferredLanguage", ({ preferredLanguage }) => {
      if (preferredLanguage) {
        setSelectedLanguage(preferredLanguage);
      } else {
        setSelectedLanguage("en"); // fallback to English
      }
    });
  }, []);

  useEffect(() => {
    console.log("🌐 Language state has changed:", selectedLanguage);
  }, [selectedLanguage]);
  console.log("📤 Sending transcript with language:", selectedLanguage);

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
          dispatch(setLoading(false));
          dispatch(setTranscript(message.transcript));

          // Save or log the preferred language
          const language = message.language || "English";
          console.log("🌐 Language received with transcript:", language);

          // Store in local state or Redux if needed
          localStorage.setItem("lastTranscriptLanguage", language);

          if (message.transcript.length > 3000) {
            dispatch(
              setStatus("⚠️ Transcript too long! Try reducing time range.")
            );
          } else {
            dispatch(setStatus("✅ Transcript fetched! Ready to send."));
          }
        } else {
          console.log("❌ Invalid transcript received:", message.transcript);
          dispatch(setStatus("❌ Failed to fetch transcript."));
          dispatch(setLoading(false));
        }
      }

      if (message.type === "YOUTUBE_TRANSCRIPT_DONE") {
        console.log("✅ Final send complete, char count:", message.charCount);
        dispatch(setLoading(false));
        dispatch(setStatus("✅ Transcript sent to ChatGPT!"));
        setTimeout(() => dispatch(setStatus("")), 4000);

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
    if (loading) return; 
    dispatch(setStatus("Fetching transcript..."));
    dispatch(setLoading(true));

    // Timeout fallback
    window._transcriptTimeout = setTimeout(() => {
      dispatch(setLoading(false));
      dispatch(
        setStatus(
          "❌ No response. Try refreshing YouTube or re-selecting a tab."
        )
      );
    }, 60000);

    // Format validation: mm:ss or m:ss
    const isValidTime = (str) => /^(\d{1,2}):([0-5]?\d)$/.test(str);
    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      setTimestampError("❌ Please enter timestamps in mm:ss format.");
      dispatch(setLoading(false));
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
      dispatch(setLoading(false));
      return;
    }

    // Get video duration from the active YouTube/Instagram tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) {
        setTimestampError("❌ Could not find active video tab.");
        dispatch(setLoading(false));
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
            dispatch(setLoading(false));
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

          // ✅ Store video data and update sliders
          setSliderStart(0);
          setSliderEnd(Math.floor(durationSec));
          setVideoDuration(durationSec);
          setTimestampError(""); // ✅ Clear errors if all is good

          // ✅ Finally send to background script
          setLastUsedStart(startTime);
          setLastUsedEnd(endTime);
          console.log("📤 Sending SEND_TO_CHATGPT from Convert button", {
            contentTabId: tabId,
            startTime,
            endTime,
            selectedTabId,
          });
          chrome.runtime.sendMessage({
            type: "SEND_TO_CHATGPT",
            contentTabId: tabId,
            startTime,
            endTime,
            selectedTabId,
          });
        }
      );
    });
  };

  return (
    <div className="w-[320px] h-[500px] bg-gray-100 p-4">
      {showSettings && (
        <div className="absolute top-0 left-0 w-full h-full bg-white shadow-lg z-50 animate-slide-in p-4">
          <h2 className="text-lg font-bold mb-4">Settings</h2>

          <label className="block mb-2 text-sm font-semibold">
            Select Language
          </label>
          <select
            value={selectedLanguage}
            onChange={(e) => {
              const lang = e.target.value;
              setSelectedLanguage(lang);
              chrome.storage.local.set({ preferredLanguage: lang });
            }}
            className="w-full p-2 border border-gray-300 rounded-lg"
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="ja">Japanese</option>
            <option value="ko">Korean</option>
          </select>

          <button
            onClick={() => setShowSettings(false)}
            className="mt-6 w-full bg-black text-white py-2 rounded-lg shadow hover:bg-gray-900"
          >
            Close Settings
          </button>
        </div>
      )}
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

      <button
        onClick={() => setShowSettings(!showSettings)}
        className="absolute top-1 right-1 rounded-full hover:shadow-md transition"
        title="Settings"
      >
        <span role="img" aria-label="Settings" className="text-xl">
          ⚙️
        </span>
      </button>

      {chatTabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => handleSelect(tab.id)}
          className={`w-full py-2 px-4 mb-3 ${
            selectedTabId === tab.id
              ? "bg-green-500 text-white"
              : "bg-gray-300 text-black"
          } font-bold rounded-lg shadow-md hover:bg-green-600 transition-all duration-200`}
        >
          {tab.title}
        </button>
      ))}
      {status && (
        <p style={{ marginBottom: "10px", fontWeight: "bold" }}>{status}</p>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center mt-6 space-y-2">
          <div className="relative drop-shadow-[0_0_6px_rgba(34,197,94,0.7)]">
            <div className="w-8 h-8 border-[3px] border-t-green-500 border-b-green-500 border-l-gray-300 border-r-gray-300 rounded-full spin-smooth" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_6px_rgba(34,197,94,0.8)]" />
            </div>
          </div>

          <p className="text-sm text-gray-700 font-medium tracking-wide animate-pulse">
            Transcribing audio, please wait…
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-semibold mb-1">Start Time</label>
          <input
            type="text"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            placeholder="e.g., 02:15"
            className="border border-gray-300 rounded-lg p-2 w-full focus:outline-none focus:ring-2 focus:ring-green-400 transition-all duration-200"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">End Time</label>
          <input
            type="text"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            placeholder="e.g., 05:45"
            className="border border-gray-300 rounded-lg p-2 w-full focus:outline-none focus:ring-2 focus:ring-green-400 transition-all duration-200"
          />
        </div>
      </div>

      {videoDuration && (
        <div className="my-4 space-y-2">
          <p className="text-sm text-gray-600">
            Start: {Math.floor(sliderStart / 60)}:
            {String(sliderStart % 60).padStart(2, "0")} → End:{" "}
            {Math.floor(sliderEnd / 60)}:
            {String(sliderEnd % 60).padStart(2, "0")}
          </p>

          <div
            className="relative h-2 rounded bg-gray-200"
            style={{
              background: `linear-gradient(
          to right,
          #22c55e ${Math.floor((sliderStart / videoDuration) * 100)}%,
          #e5e7eb ${Math.floor((sliderStart / videoDuration) * 100)}%,
          #e5e7eb ${Math.floor((sliderEnd / videoDuration) * 100)}%,
          #ef4444 ${Math.floor((sliderEnd / videoDuration) * 100)}%
        )`,
            }}
          >
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
                    `${Math.floor(val / 60)}:${String(val % 60).padStart(
                      2,
                      "0"
                    )}`
                  );
                }
              }}
              title={`Start: ${startTime}`}
              className="absolute left-0 w-full appearance-none bg-transparent pointer-events-auto h-2"
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
                    `${Math.floor(val / 60)}:${String(val % 60).padStart(
                      2,
                      "0"
                    )}`
                  );
                }
              }}
              title={`End: ${endTime}`}
              className="absolute left-0 w-full appearance-none bg-transparent pointer-events-auto h-2"
            />
          </div>
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

      <button
        onClick={handleSend}
        disabled={loading}   
        className="w-full py-2 px-4 mb-3 bg-black hover:bg-gray-800 text-white font-bold rounded-lg shadow-lg transition-all duration-200"
      >
        Convert Video Transcript
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
                type: "SEND_TRANSCRIPT_TO_CHATGPT",
                transcript: rawTranscript,
                selectedChatTabId: selectedTabId,
                language: selectedLanguage || "en", // always pass a valid code
              });
              dispatch(setStatus("Fetching transcript..."));
              dispatch(setLoading(true));
            }}
            className={
              "w-full py-2 px-4 mb-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg shadow-md transition-all duration-200"
            }
          >
            Send to ChatGPT
          </button>
        </>
      )}
    </div>
  );
}

export default App;
