import { createSlice } from "@reduxjs/toolkit";

const transcriptSlice = createSlice({
  name: "transcript",
  initialState: {
    status: "",        // For messages like "Fetching..." or "Ready!"
    loading: false,    // For spinners
    transcript: "",    // The raw transcript text
    charCount: null,   // How long the transcript is
    description: "",  // The video description text
  },
  reducers: {
    setStatus: (state, action) => {
      state.status = action.payload;
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setTranscript: (state, action) => {
      state.transcript = action.payload;
      state.charCount = action.payload.length;
    },
    clearTranscript: (state) => {
      state.transcript = "";
      state.charCount = null;
    },
    setDescription: (state, action) => {
      state.description = action.payload;
    },    
  },
});

export const { setStatus, setLoading, setTranscript, clearTranscript, setDescription, } = transcriptSlice.actions;
export default transcriptSlice.reducer;
