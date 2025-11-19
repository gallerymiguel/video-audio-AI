
---

# **transcriptSlice.js — Documentation**

This file defines the **Redux state machine** that controls all transcript-related data in the Chrome extension popup UI. Redux Toolkit’s `createSlice` is used because it bundles the state, actions, and reducers into one cohesive module with fewer lines of code and built-in immutability.

This slice is the “single source of truth” for anything related to the current transcript, the loading state, the status message, and any metadata like character count or video description.

---

## **1. Initial State**

```js
initialState: {
  status: "",        
  loading: false,    
  transcript: "",    
  charCount: null,   
  description: "",  
}
```

### What each field is for:

### **status**

A simple string used to display user-facing messages like:

* “Fetching transcript…”
* “Ready”
* “Audio uploaded”
* “Error: No captions found”

This is useful for debugging AND UX because the UI can express what stage the app is in.

### **loading**

A boolean flag that triggers spinners / disabled buttons in the popup.
Whenever the app is doing something async (fetching captions, slicing audio, sending to Whisper, etc.) this flips to `true`.

### **transcript**

Holds the **full raw transcript text**, regardless of whether it came from YouTube captions, Instagram captions, or Whisper audio transcription.

This is the main output users care about.
Other parts of the UI — such as the length counter, the ChatGPT sender, or quality warnings — all rely on this.

### **charCount**

Computed metadata derived from `transcript.length`.
Useful for:

* enforcing character limits
* knowing how large the input is before sending it to ChatGPT
* showing live character count to the user

### **description**

This stores the **video description** (if the user checks “include description”).
This exists separately from transcript because:

* Some videos rely heavily on description (recipes, tutorials)
* ChatGPT prompts merge transcript + description differently
* The UI needs to show description separately from transcript

---

## **2. Reducers & Actions**

These are pure functions that update state. They are automatically turned into action creators by Redux Toolkit.

### **setStatus**

```js
setStatus: (state, action) => {
  state.status = action.payload;
}
```

Updates the user-facing status text.

---

### **setLoading**

```js
setLoading: (state, action) => {
  state.loading = action.payload;
}
```

Controls the spinner and disables UI interactions during async work.

---

### **setTranscript**

```js
setTranscript: (state, action) => {
  state.transcript = action.payload;
  state.charCount = action.payload.length;
}
```

This is the most important reducer in the slice.

Why?

* It updates the transcript itself
* Automatically recalculates `charCount`
* Keeps state consistent even when Whisper returns huge transcripts

This is used when:

* YouTube captions arrive
* Instagram captions arrive
* Whisper backend returns a transcription
* The user resets timestamps and fetches again

---

### **clearTranscript**

```js
clearTranscript: (state) => {
  state.transcript = "";
  state.charCount = null;
}
```

Resets transcript state back to “empty.”
Used when:

* Switching videos
* Fixing invalid timestamps
* User presses “Clear” button
* Error states where transcript should disappear

---

### **setDescription**

```js
setDescription: (state, action) => {
  state.description = action.payload;
}
```

Stores or clears the video description text.
Used only when the user enables “include description.”

---

## **3. Exports**

```js
export const {
  setStatus,
  setLoading,
  setTranscript,
  clearTranscript,
  setDescription,
} = transcriptSlice.actions;

export default transcriptSlice.reducer;
```

This gives the App.jsx:

* Action creators to dispatch state changes
* The reducer to inject into your Redux store

---

## **4. Why Redux instead of local state?**

Good for interview explanations:

* Transcript data must be available across multiple components (`SettingsPanel`, `AuthPage`, main popup).
* Transcript state outlives component unmounts when switching UI panels.
* Background.js messages and Whisper responses need a **central store**, not component-level state.
* Redux Toolkit creates predictable, testable state management.

This slice is small, but it anchors the entire UI and is essential for clean architecture.

---

