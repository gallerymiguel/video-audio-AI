// config.js

console.log("🧾 config.js loaded into page");


window.postMessage(
  {
    type: "CONFIG_DATA",
    payload: {
      WHISPER_SERVER_URL: "https://whisper-server-ajdt.onrender.com",
      GRAPHQL_URL: "https://chrome-extension-backend-iubp.onrender.com/graphql",
    },
  },
  "*"
);


console.log("🧾 config.js loaded into page");
