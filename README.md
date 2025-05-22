
# 📽️ ChatGPT Video Transcript Assistant (Chrome Extension)

A powerful Chrome extension that extracts video transcripts from YouTube and Instagram, slices timestamps, and sends content directly to ChatGPT for summarization or translation. Also supports subscription management with Stripe and backend Whisper transcription via Express.

---

## 🚀 Features

- ⏱️ Select custom start/end times from any video
- 🧠 Send transcripts to ChatGPT with optional description
- 🎙️ Audio recording + Whisper API for Instagram videos
- 🌐 Multilingual caption support
- 🔐 Token usage tracking & monthly limits
- 💳 Stripe subscription to unlock Instagram features

---

## 🧩 Tech Stack

- **Frontend**: React + Redux + Tailwind
- **Chrome Extension**: Manifest V3, background/content/popup
- **Backend**: Node.js + Express + GraphQL + Whisper
- **Payments**: Stripe (Checkout + Webhooks)
- **Authentication**: JWT
- **Deployment**: Render (Dockerized), GitHub Actions (CI/CD)

---

## 🛠️ Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/yourusername/video-transcript-extension.git
cd video-transcript-extension
```

### 2. Install dependencies

```bash
npm install
```

### 3. Add your `.env` file

Create a `.env` file in the root of your frontend and backend with:

```env
# Frontend
VITE_WHISPER_SERVER_URL=http://localhost:3000
VITE_GRAPHQL_URL=http://localhost:4000/graphql
VITE_STRIPE_PUBLIC_KEY=your-stripe-pk

# Backend
OPENAI_API_KEY=your-openai-key
STRIPE_SECRET_KEY=your-stripe-secret
BACKEND_GRAPHQL_URL=http://localhost:4000/graphql
```

### 4. Build the extension

```bash
npm run build
```

Load `dist/` folder into `chrome://extensions` (enable Developer Mode).

---

## 📦 Folder Structure

```
├── public/
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   └── config.js
├── src/
│   ├── App.jsx
│   ├── redux/
│   └── components/
├── server/
│   ├── whisper-server.js
│   └── graphql-server.js
├── .env
├── Dockerfile
└── README.md
```

---

## 🔒 Security Notes

- Ensure `config.js` doesn't expose secrets (only URLs)
- Use `.env` for all API keys and backend endpoints
- Never hardcode tokens or keys into content/background scripts

---

## 🧪 TODO

- [ ] CI/CD with GitHub Actions
- [ ] Replace `localhost` with production URLs
- [ ] Add Stripe Webhook verification
- [ ] Add user dashboard for token tracking

---

## 🧠 Credits

Built with love by Miguel Urdiales — optimizing video learning with AI ❤️
