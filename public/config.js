// config.js

window.postMessage(
  {
    type: "CONFIG_DATA",
    payload: {
      WHISPER_SERVER_URL: "https://whisper-server-ajdt.onrender.com",
      // WHISPER_SERVER_URL: "http://localhost:3000",
      GRAPHQL_URL: "https://chrome-extension-backend-iubp.onrender.com/graphql",
      // GRAPHQL_URL: "http://localhost:4000/graphql",
      // GRAPHQL_URL: "https://8f5c-136-49-49-188.ngrok-free.app/graphql",
    },
  },
  "*"
);
