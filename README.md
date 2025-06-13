# 📽️ ChatGPT Video-Transcript Assistant (Chrome Extension)

Chrome extension that grabs **Instagram Reels / Shorts** transcripts, slices timestamps, and pipes everything to **ChatGPT** for instant summarization or translation.   
Pro version records audio + runs Whisper transcription on your server. Stripe handles subscriptions & limits.

---

## 🚀 Features

| Core | Pro (Stripe) |
|------|--------------|
| ⏱️ Select custom start / end points | 🎙️ Record Instagram audio & send to Whisper |
| 🧠 One-click “Summarize with ChatGPT” | 🌐 Multilingual captions |
| 🔐 Token usage tracking & monthly limits | |

---

## 📦 Repositories

| Part | GitHub link | Stack |
|------|-------------|-------|
| **Chrome extension (frontend)** | `https://github.com/gallerymiguel/video-audio-AI` | React + Redux, Tailwind, Manifest v3 |
| **GraphQL back-end** | `https://github.com/gallerymiguel/chrome-extension-backend` | Node, Express, Apollo GraphQL, MongoDB |
| **Whisper back-end** | `https://github.com/gallerymiguel/my-whisper-server` | Node, Express, OpenAI Whisper |

**GraphQL back-end Render** | `https://chrome-extension-backend-iubp.onrender.com/`
**Whisper back-end Render** | `https://whisper-server-ajdt.onrender.com/`
---

## 🧩 Tech Stack (extension)

| Layer | Tech |
|-------|------|
| UI       | React + Redux, Tailwind, Vite |
| Browser  | Chrome Extension Manifest v3 (popup / background / content scripts) |
| Auth     | JWT stored in chrome.storage.sync |

---

## 🛠️ Quick Start (Dev)

```bash
# 1 Clone extension repo
git clone git@github.com:gallerymiguel/video-audio-AI.git
cd video-audio-AI && npm i

# 2 Env vars
cp .env      # edit endpoints & Stripe key

# 3 Build and load into Chrome
npm run build
# then drag dist/ into chrome://extensions  (enable Dev mode)
```

Back-ends have their own READMEs.

---

## 📁 Folder Structure (extension)

```
public/
  ├─ manifest.json
  ├─ background.js
  └─ content.js
src/
  ├─ App.jsx
  ├─ hooks/
  ├─ redux/
  └─ components/
.env
README.md
```

---

## 🔒 Security Guidelines

* Never commit API keys; keep them in `.env` (already git-ignored).  
* Content & background scripts only send **Bearer tokens**, never secrets.  
* Stripe webhooks verified with signature (see back-end README).

---

## 🧱 Roadmap / TODO

- [ ] CI pipeline: lint → unit tests  
- [ ] Replace localhost URLs with Render prod URLs  
- [ ] User dashboard: view token balance & Stripe invoices  
- [ ] Migrate MongoDB → MariaDB if back-end switches

---

### 🧠 Built & maintained by **Miguel Urdiales**

<small>Video learning, optimized by AI ❤️</small>
