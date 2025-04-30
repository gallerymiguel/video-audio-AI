import { configureStore } from "@reduxjs/toolkit";
import transcriptReducer from "./transcriptSlice";

const store = configureStore({
    reducer: {
      transcript: transcriptReducer,
    },
    
    devTools: true, 
  });  

export default store;
