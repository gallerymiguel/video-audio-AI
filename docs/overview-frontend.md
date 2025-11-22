```js
import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  setStatus,
  setLoading,
  setTranscript,
  clearTranscript,
  setDescription,
} from "./transcriptSlice";
import AuthPage from "./components/AuthPage.jsx";
import useSubscriptionStatus, {
  useStartSubscription,
} from "./hooks/useSubscriptionStatus";
import useUsageCount from "./hooks/useUsageCount";
import SettingsPanel from "./components/SettingsPanel";
import Toast from "./components/Toast";
```

### React and Redux hooks

**`useState` and `useEffect`**

* `useState` lets this component keep its own private state. Things like:

  * whether the settings panel is open
  * whether the confirmation modal is visible
  * a temporary piece of UI state that does not need to be global
* `useEffect` lets the component react to lifecycle events. Examples:

  * when the popup opens, detect the active tab or load stored settings
  * when subscription status changes, show a toast
  * when the transcript updates, maybe scroll a container to the bottom

So these two hooks are how App.jsx manages its own internal behavior over time.

**`useSelector` and `useDispatch`**

* `useSelector` reads data from the Redux store. In this app, that means:

  * the current transcript text
  * the description text
  * current status like `"idle"`, `"loading"`, `"error"`
  * flags that control when the UI should show spinners or messages
* `useDispatch` sends actions to Redux. That is how the component tells the global state: “the transcript is ready,” or “we just started loading,” or “clear everything.”

Big picture:
React hooks handle local, one-component concerns. Redux hooks handle shared state that needs to be the same across multiple parts of the extension.

---

### Transcript slice actions

```js
import {
  setStatus,
  setLoading,
  setTranscript,
  clearTranscript,
  setDescription,
} from "./transcriptSlice";
```

These are the “verbs” of your transcript state machine:

* `setStatus` updates a high level state like `"idle"`, `"fetching"`, `"sending"`, or `"error"`. This is useful for showing different UI states and for debugging.
* `setLoading` is a more direct flag used to control spinners or disabling buttons while work is happening.
* `setTranscript` stores the latest transcript text in Redux. Any component that needs the text (main display, character counter, etc.) can read it through `useSelector`.
* `clearTranscript` wipes the transcript and related state. This supports “start over” behavior.
* `setDescription` stores the video description text, if the user chose to include it.

These actions are the glue between the popup UI, the background script, and the Whisper server. They turn external events into predictable state changes that the UI can render.

---

### Auth and subscription hooks

```js
import AuthPage from "./components/AuthPage.jsx";
import useSubscriptionStatus, {
  useStartSubscription,
} from "./hooks/useSubscriptionStatus";
import useUsageCount from "./hooks/useUsageCount";
```

* `AuthPage` is the separate component that handles login and registration. App.jsx will decide “show AuthPage” or “show the main tool” depending on whether a valid JWT is present. That keeps all the auth UI logic encapsulated.

* `useSubscriptionStatus` is a custom hook that hides the logic for calling the `checkSubscriptionStatus` GraphQL query. It probably returns things like:

  * `isSubscribed`
  * `isLoading`
  * `error`

  Because this is wrapped in a hook, the rest of App.jsx can just ask “is this user premium” without worrying about the details of the API call.

* `useStartSubscription` is another hook from the same file that likely exposes a function that calls the `startSubscription` mutation and gets back a Stripe Checkout URL. App.jsx can call it when the user clicks an “Upgrade” button.

* `useUsageCount` is the hook that talks to `getUsageCount` on the backend. It keeps track of the user’s current token usage and maybe whether they are close to a limit. This is important for:

  * deciding when to show warnings
  * blocking long runs that would go over the limit

Together, these hooks keep all Stripe and usage logic organized and reusable, so App.jsx does not become a huge blob of network calls.

---

### UI components: Settings and Toast

```js
import SettingsPanel from "./components/SettingsPanel";
import Toast from "./components/Toast";
```

* `SettingsPanel` is the UI for configuration inside the popup:

  * language selection
  * options like “include video description”
  * maybe future flags (tone of summary, translation preferences, etc.)

  Having this in its own component keeps layout and settings logic separate from the more complex main logic in App.jsx.

* `Toast` is a small component for showing temporary messages:

  * success notifications like “Transcript copied”
  * error messages like “Usage limit reached”
  * warnings like “No video detected on this tab”

Instead of using `alert`, this gives you a polished, non-blocking way to give feedback to the user.

---

Here is a clean, *deep technical explanation* of this block of **App.jsx**, written so you fully understand **what it does, why it exists, and how it fits into the rest of your extension’s architecture**.

We’ll treat each piece separately:

---

# 🎨 **1. Dynamically injecting a `<style>` tag**

```js
const styleTag = document.createElement("style");
styleTag.textContent = `
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}`;
document.head.appendChild(styleTag);
```

### **What this does**

You are creating a CSS animation entirely from JavaScript:

* `document.createElement("style")` → makes a `<style>` tag in memory.
* `styleTag.textContent = "...";` → fills it with a `@keyframes spin` animation.
* `document.head.appendChild(styleTag);` → inserts it into the `<head>` of your extension popup.

### **Why the animation must be inserted manually**

You built your extension using **React + Vite**, but Chrome extensions load styles differently:

* No global CSS file is guaranteed to load.
* Popup styling resets on every open.
* Inline styles cannot use `@keyframes`.

So anything like this:

```css
.loader { animation: spin 1s linear infinite; }
```

would break without the keyframes being defined somewhere global.

Injecting a `<style>` tag ensures:

* The spinner animation always exists
* It works regardless of popup reloads
* It doesn’t require a separate CSS file inside the extension

### **Why this animation matters for UX**

This keyframe drives your **loading spinner** animation anywhere in the popup UI:

* When transcription is loading
* When Stripe is being checked
* When fetching usage count
* When chopping audio
* When communicating with the Whisper backend

Without this animation, your spinner would be static.

---

# ⏱️ **2. Time parsing utility: `parseTimeToSeconds`**

```js
function parseTimeToSeconds(str) {
  if (!str || typeof str !== "string") return null;
  const match = str.match(/^(\d+):(\d{2})$/);
  if (!match) return null;

  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  if (isNaN(minutes) || isNaN(seconds)) return null;

  return minutes * 60 + seconds;
}
```

### **What the function does**

This converts a timestamp like `"01:32"` into total seconds (`92`).

### **Why you need this at all**

Your extension supports **partial transcription**:

* A user chooses a start timestamp (e.g., 00:15)
* And an end timestamp (e.g., 01:00)

The backend expects timestamps in *pure seconds* because FFmpeg slicing uses second-based start/duration.

So this function performs:

```
"MM:SS" → total seconds
```

### **Breakdown of its logic**

#### **Step 1: Input safety**

```js
if (!str || typeof str !== "string") return null;
```

* Avoids crashes if UI sends undefined, empty string, or non-strings.

#### **Step 2: Validate format**

```js
const match = str.match(/^(\d+):(\d{2})$/);
```

This requires:

* minutes: 1+ digits
* colon
* seconds: exactly 2 digits

Examples accepted:

* "0:05"
* "01:30"
* "15:09"

Examples rejected:

* "1"
* "1:2"
* "abc"
* "01:300"

This protects FFmpeg from receiving bad values.

#### **Step 3: Convert the matched groups**

```js
const minutes = parseInt(match[1], 10);
const seconds = parseInt(match[2], 10);
```

#### **Step 4: Final calculation**

```js
return minutes * 60 + seconds;
```

So:

* "1:30" → 90
* "12:00" → 720
* "00:01" → 1

### **Why this is critical for your extension**

Your Whisper server has logic like:

```js
const duration = end - start;
ffmpeg.setStartTime(start).duration(duration);
```

If this function fails, the backend:

* can slice incorrectly
* can refuse to slice (safety fallback)
* can return a shorter/larger cost estimate
* may block the transcription due to invalid math

This helper function protects *everything* downstream.

---

# 🧩 **How this fits the overall architecture**

This tiny block does foundational work:

### **The `<style>` injection**

* Enables all loading animations
* Ensures visual consistency across popup reloads

### **`parseTimeToSeconds`**

* Ensures the frontend always sends **valid, safe, properly formatted** slicing timestamps
* Prevents backend slicing errors
* Helps maintain accurate token usage estimation
* Allows partial transcription (the most advanced feature of your extension)

---

Here is the full *deep-understanding* explanation of this block of code.
We’ll take it slow and focus on **what it does**, **why it matters**, and **where it fits into the architecture** of your Chrome extension popup.

---

# 🎨 **What this code does**

```js
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
```

This is dynamically injecting another `<style>` tag into the popup's `<head>`, just like your spinner animation, except this time it's providing **a reusable fade-in fade-out animation class**.

---

# 🔍 **Why dynamically insert fade animation CSS?**

Chrome extension popups are **not typical React apps**:

* They reload every time you open them
* They don't persist global CSS files unless you manually include them
* They isolate CSS per popup load
* They don’t automatically load external stylesheets from file system unless listed in manifest

So this animation needs to be inserted **every time the popup opens**, so that React components can rely on the `.fade-in-out` class existing.

If you do not inject this `<style>`:

* Your fade animations break
* Your "status messages" and "usage warnings" would pop in instantly instead of smoothly
* You lose UX polish

This is a **foundational UX bit** for how your whole interface looks and feels.

---

# 🎞️ **How the fade animation works**

### **1. Default state**

```css
.fade-in-out {
  opacity: 0;
  transition: opacity 0.5s ease-in-out;
}
```

This means:

* The element is initially invisible (`opacity: 0`)
* Any future change in opacity will animate smoothly over **0.5 seconds**

### **2. Visible state**

```css
.fade-in-out.show {
  opacity: 1;
}
```

When you *add* the class `.show`:

* The opacity changes from `0 → 1`
* Because `.fade-in-out` has `transition: opacity 0.5s ease-in-out`,
  the browser animates it automatically.

### **This creates a reusable fade animation**

Any component can now do:

```jsx
<div className={`fade-in-out ${show ? "show" : ""}`}>
  You’re out of credits!
</div>
```
---

# 🧩 **How this fits your architecture**

### Your UI uses *two* core animation systems:

1. **Spinner — built with keyframes**
2. **Fade animation — built with CSS classes**

Both are injected into the document head to solve the popup reload problem.

This block specifically empowers:

* Smooth status transitions
* Animated warnings
* Toast messages
* Loading messages fading in
* Description/transcript previews appearing smoothly
* "Login successful" confirmation
* "Fetching transcript…" → fade in → fade out

This is a UX backbone.

---

## 1. Hooking into Redux

```js
const dispatch = useDispatch();
const status = useSelector((state) => state.transcript.status);
const loading = useSelector((state) => state.transcript.loading);
const rawTranscript = useSelector((state) => state.transcript.transcript);
const charCount = useSelector((state) => state.transcript.charCount);
const description = useSelector((state) => state.transcript.description);
```

**What this does**

* `useDispatch()` gives you the function for dispatching Redux actions like `setStatus`, `setTranscript`, etc.
* `useSelector(...)` reads values from the `transcript` slice in Redux:

  * `status` is a short message like “Fetching transcript...” or “Ready”.
  * `loading` powers your spinner and disables buttons when true.
  * `rawTranscript` is the main text your extension extracted.
  * `charCount` is derived from the transcript length and is used to show how “big” the prompt is.
  * `description` stores the YouTube or Instagram video description.

**Why this matters**

This keeps all transcript related data in a single, predictable store.
Any component in the popup can read or update it without prop drilling.

When you open the popup during the same session, Redux is the source of truth for:

* current transcript
* character count
* status messages
* description text

It makes the whole UI consistent.

---

## 2. Managing tabs and target ChatGPT tab

```js
const [chatTabs, setChatTabs] = useState([]);
const [selectedTabId, setSelectedTabId] = useState(null);
```

**What this does**

* `chatTabs` holds a list of detected ChatGPT tabs in Chrome.
* `selectedTabId` stores which ChatGPT tab you want to send the transcript into.

**Why this matters**

Your extension is special because it can:

* Find all open `chatgpt.com` tabs
* Let the user choose which one to send the prompt into

So this state is the bridge between “I have a transcript” and “which exact tab should receive this prompt”.

---

## 3. Timestamp and slicing controls

```js
const [startTime, setStartTime] = useState("00:00");
const [endTime, setEndTime] = useState("00:00");
const [timestampError, setTimestampError] = useState("");
const [videoDuration, setVideoDuration] = useState(null);
const [sliderStart, setSliderStart] = useState(0);
const [sliderEnd, setSliderEnd] = useState(0);
const [lastUsedStart, setLastUsedStart] = useState(null);
const [lastUsedEnd, setLastUsedEnd] = useState(null);
```

**What each one means**

* `startTime` and `endTime`: the manual text fields in `mm:ss` the user types in.
* `timestampError`: shows messages like “End time must be after start time” or “Time exceeds video length”.
* `videoDuration`: total length of the current video in seconds (fetched from the content script).
* `sliderStart` and `sliderEnd`: numeric positions for the slider UI, usually in seconds or a normalized range.
* `lastUsedStart` and `lastUsedEnd`: remember the last successfully used slice. Good for UX when retrying or debugging.

**Why this matters**

Your app is not “just a full transcript” tool. It lets the user:

* Slice a specific part of the audio
* Send only that chunk to Whisper
* Save tokens and time

All of this timestamp and slider state is how the popup expresses that slicing feature.

---

## 4. UI toggles and layout state

```js
const [showSettings, setShowSettings] = useState(false);
const [waitingForVideo, setWaitingForVideo] = useState(false);
const [videoError, setVideoError] = useState(false);
const [selectedLanguage, setSelectedLanguage] = useState("en");
const [includeDescription, setIncludeDescription] = useState(false);
```

**Breakdown**

* `showSettings`: controls whether the settings panel is visible.
* `waitingForVideo`: true while you are waiting for the content script to respond with metadata or transcript.
* `videoError`: marks a failure like “No video found” or “Site not supported”.
* `selectedLanguage`: user chosen language for interpretation or translation, default English.
* `includeDescription`: checkbox to optionally send the video description along with the transcript to ChatGPT.

**Why this matters**

These are all “user experience flags” that control what the popup shows:

* Loading vs ready
* Error vs normal
* Settings panel open vs hidden
* Language behavior
* Whether the description is included as context

They make the extension feel like a real product and not just a hacked together script.

---

## 5. Authentication and subscription state

```js
const [showAuth, setShowAuth] = useState(false);
const [showAuthButton, setShowAuthButton] = useState(true);
const [authToken, setAuthToken] = useState(() =>
  localStorage.getItem("token")
);
const [hasConverted, setHasConverted] = useState(false);
```

**What is going on here**

* `authToken` is loaded from `localStorage` the first time. This is the JWT from your GraphQL backend.
* `showAuth` controls whether the login/register page is shown inside the popup.
* `showAuthButton` is useful to hide the login button once the user is authenticated.
* `hasConverted` looks like a flag for “have we already run a conversion this session”, used for UX or gating.

**Why this matters**

Your extension is not a purely free tool. You have:

* Login
* Per user token usage
* Stripe subscriptions

These states are what allow the frontend to show:

* “Log in” vs “You are logged in”
* “Subscribe / Upgrade” vs “You are premium”
* When to show the auth form

And `authToken` is the key link between popup and GraphQL backend.

---

## 6. Subscription and Stripe checkout hooks

```js
const {
  isSubscribed,
  loading: subLoading,
  error,
  refetch,
} = useSubscriptionStatus(authToken);

const { initiateCheckout, loading: checkoutLoading } = useStartSubscription();
const [showUpgradeModal, setShowUpgradeModal] = useState(false);
```

**What this does**

* `useSubscriptionStatus(authToken)` hits your GraphQL backend and tells you:

  * `isSubscribed`: if the user has an active subscription
  * `subLoading`: whether the check is still in progress
  * `error`: if something went wrong
  * `refetch`: lets you recheck after login, after a successful payment, etc
* `useStartSubscription()` wraps the Stripe checkout mutation and returns:

  * `initiateCheckout()`: when called, opens Stripe Checkout in a new tab
  * `checkoutLoading`: tells you if the checkout mutation is running
* `showUpgradeModal` controls if you show a modal that tells free users about upgrading or hitting usage caps.

**Why this matters**

This is the frontend side of your whole Stripe flow:

* It finds out whether the user is subscribed
* It can trigger Stripe Checkout
* It can guide users when they hit a limit

This is the connective tissue between:

* GraphQL backend
* Stripe
* Popup UI

---

## 7. Usage tracking and warnings

```js
const {
  usageCount,
  loading: usageLoading,
  refetch: refetchUsage,
} = useUsageCount();
const [localUsage, setLocalUsage] = useState(usageCount);
```

**What this does**

* `useUsageCount()` calls your `getUsageCount` query:

  * `usageCount`: how many tokens the backend thinks the user has used
  * `usageLoading`: loading flag
  * `refetchUsage()`: used after each transcription to update the count
* `localUsage` mirrors `usageCount` locally so you can optimistically update the UI right after a transcription, without waiting for the next fetch.

**Why this matters**

This is how your frontend:

* Knows how close the user is to 8,000 token limit
* Shows “usage bar” or a count
* Decides when to show upgrade modal or warning banners
* Keeps the user aware of their usage

It is directly tied to your limiter logic in `checkAndResetUsage`.

---

## 8. Notifications and confirmation UI

```js
const [toastMessage, setToastMessage] = useState(null);
const [confirmMessage, setConfirmMessage] = useState(null);
```

**What they do**

* `toastMessage` powers the `Toast` component to show transient messages like:

  * “Transcript copied to clipboard”
  * “Sent to ChatGPT”
  * “Usage updated”
  * “Language set to Spanish”
* `confirmMessage` powers `ConfirmModal` for things like:

  * “Are you sure you want to clear the transcript?”
  * “Are you sure you want to overwrite the current selection?”

**Why this matters**

These are the final UX layer on top of all that logic.
They help users understand what just happened and prevent accidental actions.

---

# 📘 **Documentation: useEffects in App.jsx (Part 1)**

## **1️⃣ useEffect — reacts when the authToken changes**

```js
useEffect(() => {
  if (authToken) {
  }
}, [authToken]);
```

### **What it does**

Right now, this effect doesn't contain logic — but its purpose is clear:

> **This effect runs every time the authentication token changes.**

That means it triggers when:

* the user logs in
* the user logs out
* the app boots and reads an existing token
* the token is replaced (e.g., refresh flow someday)

### **Why this matters**

Even though the block is empty, this effect is part of your app’s *reactive authentication pipeline*.

How React sees it:

1. User logs in → token updates
2. `useEffect` runs
3. Any future code added here can cascade off login changes

You used to have code in here (e.g., refetching subscription, hiding auth panel), and the structure remains for future expansion.

### **In documentation terms**

This exists as a **reactive authentication hook**—a placeholder for logic tied to login state changes.

---

## **2️⃣ useEffect — load token from localStorage on startup**

```js
useEffect(() => {
  const t = localStorage.getItem("token");
  if (t) setAuthToken(t);
}, []);
```

### **What it does**

This effect runs **once**, when the popup loads (empty dependency array = “on mount”).

Inside it:

* It checks whether a saved JWT exists in `localStorage`.
* If found, it hydrates your React state with that token.

### **Why this matters**

This is what makes your Chrome extension **remember the user is logged in**, even after the popup closes.

Without this effect:

* User closes popup
* Reopens popup
* Suddenly logged out
* Bad UX

With this effect:

* Token is restored
* Auth state reloads
* Subscription hooks refetch
* UI stays "logged in"

This is the closest thing your popup has to a **session restore mechanism**.

### **In documentation**

This should be labeled as:

> **Authentication Persistence Layer — restores login state on popup startup.**

---

## **3️⃣ useEffect — sync backend usage count into local state**

```js
useEffect(() => {
  setLocalUsage(usageCount);
}, [usageCount]);
```

### **What it does**

This effect runs every time `usageCount` changes (which comes from your GraphQL backend).

It copies that value into:

```js
localUsage
```

### **Why this matters**

This design uses **optimistic UI**:

* You want the frontend to instantly update usage after a transcription
* But you ALSO want backend accuracy when the backend refetches

Using two layers:

| State variable | Source            | Purpose                           |
| -------------- | ----------------- | --------------------------------- |
| `usageCount`   | backend (GraphQL) | The correct, authoritative number |
| `localUsage`   | client            | Instantly updated UI counter      |

This effect ensures they stay synced:

* When backend updates → UI updates
* When local UI updates → backend will eventually match

Without this effect:

* UI could show old usage numbers
* Subscription paywall could be wrong
* The extension might allow usage even though the backend denies it
---

# 📘 **Documentation: Chrome Runtime Listener (App.jsx)**

## **useEffect — Listen for messages coming from background scripts**

```js
useEffect(() => {
  const listener = (message) => {
    if (message.type === "TRIGGER_USAGE_REFETCH") {
      refetch();
    }
  };

  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}, []);
```

---

## **What this block does**

This effect sets up a **message listener** that waits for incoming messages from:

* `background.js`
* `content.js`
* OR even future scripts you add

When a message arrives, it checks:

```js
if (message.type === "TRIGGER_USAGE_REFETCH")
```

If that condition is true, it triggers:

```js
refetch();
```

Which forces your GraphQL hook (`useSubscriptionStatus`) to **pull fresh subscription/usage data from your backend**.

So the chain looks like this:

```
Background script → sends message → popup receives it → popup reloads usage
```

---

## **Why this matters in your extension**

This is critical for one reason:

### **Your popup UI must react to backend changes even when the popup isn’t the one triggering them.**

For example:

### **Scenario: Transcription happens**

1. Whisper server sends a usage increment to your backend
2. Backend updates `usageCount`
3. Background script receives updated usage
4. Background script sends `"TRIGGER_USAGE_REFETCH"` to popup
5. This hook hears it → calls `refetch()`
6. UI updates instantly

Without this system, your UI would only update usage **after a popup refresh**, and that feels broken to users.

This listener keeps your UI **live and accurate**.

---

## **Why the effect has an empty dependency array**

```js
}, []);
```

This means:

* Add listener **once** when the popup mounts
* Remove listener when popup closes

If you re-added this listener on every render, you'd accidentally stack multiple listeners and cause duplicate events.

---

## **Why the cleanup function is necessary**

```js
return () => chrome.runtime.onMessage.removeListener(listener);
```

This removes the listener when the component unmounts.

If you *didn’t* remove it:

* Every time the popup opens, a new listener would stack
* After 20 openings, you’d have 20 listeners
* Messages would trigger the same code 20 times
* You could get duplicate refetches
* Eventually performance collapses

Cleanup = prevents memory leaks and event duplication.

Chrome extension popups **mount/unmount constantly**, so cleanup is absolutely required.

---

## **What sends TRIGGER_USAGE_REFETCH in your extension**

Your background script or your Whisper backend likely sends:

```js
chrome.runtime.sendMessage({ type: "TRIGGER_USAGE_REFETCH" });
```

This happens when:

* Transcription completes
* Usage increases
* A Stripe subscription event changes access rights
* A limit is reached
* Debug events occur

This message is the “bridge” from backend and background logic → into your popup UI.

---

# 📘 **Documentation: Load Preferred Language on Popup Mount**

### **Code Block**

```js
useEffect(() => {
  chrome.storage.local.get("preferredLanguage", ({ preferredLanguage }) => {
    if (preferredLanguage) {
      setSelectedLanguage(preferredLanguage);
    } else {
      setSelectedLanguage("en"); // fallback to English
    }
  });
}, []);
```

---

# 🔍 **What this effect does**

This `useEffect` runs **only once**, when the popup loads.

It retrieves the user’s previously saved language setting from:

```
chrome.storage.local
```

This is Chrome’s extension-scoped local storage system — **not** window.localStorage and not cookies.

If a saved value exists:

```js
setSelectedLanguage(preferredLanguage);
```

If not, it defaults to English:

```js
setSelectedLanguage("en");
```

So this hook allows the popup to *remember* the user’s language preference between sessions.

---

# 🧠 **Why this is important for your extension**

Your extension supports multiple languages for transcription and summarization.
Users expect the extension to **remember their preference** instead of forcing them to re-select it every time the popup opens.

Chrome extension popups behave differently from websites:
**When the popup closes, all component state disappears.**
Nothing in React survives.

Therefore you *must* persist settings manually using:

```
chrome.storage.local
```

This hook ensures:

* When your extension opens
* It immediately checks stored language
* And repopulates the UI with the correct value

This is what gives your extension a “real app” feel instead of a temporary popup.

---

# 🔑 Why chrome.storage.local instead of React state alone?

Because:

### 🔹 React state dies when popup closes

### 🔹 chrome.storage.local persists forever

This ensures:

* The user selects Spanish once
* The popup remembers it forever
* Even after the extension/browser restarts
* Even after computer shutdown

---

# 🏗️ Why the empty dependency array?

```js
}, []);
```

This runs the effect only once when the popup mounts.

If you ran this effect on every render:

* It would overwrite the user’s language constantly
* The UI would flicker
* You’d never be able to change it manually

This is correct usage.

---

# 🧩 How this ties into the rest of the extension

This hook affects:

### ✔ Whisper server language selection

### ✔ Prompt generation inside background.js

### ✔ Transcript cleaning in content.js

### ✔ ChatGPT-injection language mode

### ✔ SettingsPanel.jsx UI

Without this, every transcription would default to English, and multilingual support would essentially break.

---


```js
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

            setVideoDuration(duration);
            setSliderStart(0);
            setSliderEnd(duration);
            setStartTime("00:00");
            setEndTime(formattedEnd);

            setWaitingForVideo(false);
          } else if (attempt < 35) {
            setTimeout(() => tryGetDuration(attempt + 1), 150);
          } else {
            setWaitingForVideo(false);
            setVideoError(true);
          }
        }
      );
    };

    tryGetDuration();
  });
}, []);
```

---

### 1. The outer effect and tab lookup

```js
useEffect(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id;
    if (!tabId) return;
    ...
  });
}, []);
```

**What it does**

* `useEffect(..., [])`
  Runs once when the popup loads. This is a "setup on mount" effect.

* `chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => { ... })`
  Asks Chrome, “Give me the currently active tab in this window,” then calls the callback with that array of tabs.

* `const tabId = tabs[0]?.id;`
  Takes the first tab (the active one) and pulls out its `id`.
  The `?.` makes this safe in case `tabs[0]` does not exist.

* `if (!tabId) return;`
  If there is no active tab or no id, the effect bails. No tab id means you cannot inject scripts, so there is nothing to do.

**Why it matters**

The whole rest of the logic depends on knowing *which* tab to poke for the `<video>` element. This is the bridge from your popup to the actual Instagram or YouTube page.

---

### 2. Declaring `tryGetDuration` and starting “video probing”

```js
// Try repeatedly for up to 1.5s until video is ready
const tryGetDuration = (attempt = 0) => {
  setWaitingForVideo(true); // 🟡 START waiting when trying to fetch
  ...
};

tryGetDuration();
```

**What it does**

* `const tryGetDuration = (attempt = 0) => { ... }`
  Defines a helper function that will:

  * Inject code into the page.
  * Try to read `video.duration`.
  * If not ready yet, retry a few times.

* `setWaitingForVideo(true);`
  Sets your `waitingForVideo` state to true every time a fetch attempt starts.
  That is what your UI uses to show a spinner or “waiting for video” message.

* `tryGetDuration();`
  Immediately calls the helper for the first time with `attempt = 0`.

**Why it matters**

Videos often do not have a valid duration immediately when the popup opens, especially on slower machines or networks. This retry function is your little “poller” that keeps asking the page for the duration until it is ready, or until you give up.

---

### 3. Injecting a script into the tab to read `<video>.duration`

```js
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
    ...
  }
);
```

**What it does**

* `chrome.scripting.executeScript({ target: { tabId }, func: () => { ... } }, callback)`
  Asks Chrome to run the given `func` **inside the page context** of the active tab (Instagram / YouTube).

* Inside `func`:

  ```js
  const video = document.querySelector("video");
  return video?.duration || null;
  ```

  * Finds the first `<video>` element on the page.
  * Returns its `duration` in seconds if it exists.
  * If there is no video yet, returns `null`.

* In the callback:

  ```js
  const durationSec = results?.[0]?.result;
  ```

  `results` is an array of results for each frame. You only care about the first one, so you grab `results[0].result`.

**Why it matters**

Your popup cannot directly access DOM elements from the page.
`chrome.scripting.executeScript` is the glue that lets your popup ask, “Hey content script, what is the video duration on this page?”

This line is what turns the real video duration into a number you can use in React.

---

### 4. When duration is valid: set all the slider and time states

```js
if (typeof durationSec === "number" && durationSec > 0) {
  const duration = Math.floor(durationSec);
  const formattedEnd = `${Math.floor(duration / 60)}:${String(
    duration % 60
  ).padStart(2, "0")}`;

  setVideoDuration(duration);
  setSliderStart(0);
  setSliderEnd(duration);
  setStartTime("00:00");
  setEndTime(formattedEnd);

  setWaitingForVideo(false);
}
```

**What it does**

* `if (typeof durationSec === "number" && durationSec > 0)`
  Checks that the value returned from the page is a positive number. If it is 0 or not a number, the video probably is not ready yet.

* `const duration = Math.floor(durationSec);`
  Rounds down to a whole number of seconds. This makes slider logic and slicing easier and predictable.

* `const formattedEnd = ...`
  Turns a raw number of seconds into a `mm:ss` string:

  * `Math.floor(duration / 60)` is minutes.
  * `duration % 60` is leftover seconds.
  * `padStart(2, "0")` ensures it looks like `03:07` instead of `3:7`.

* State updates:

  * `setVideoDuration(duration);`
    Saves the duration in seconds for any logic that needs numeric values.
  * `setSliderStart(0);` and `setSliderEnd(duration);`
    Sets your slider range from 0 to full duration. So by default you are selecting the entire video.
  * `setStartTime("00:00");` and `setEndTime(formattedEnd);`
    These are the human readable inputs the user sees for start and end time, synced to the same full range.
  * `setWaitingForVideo(false);`
    Hides your “waiting” indicator, since we now successfully know the duration.

**Why it matters**

This block is what moves your UI from “I am waiting for the video to load” to “I know the video length, here is a full-range slider and time fields.”

It also keeps both slider values and text inputs in sync right from the start, which is important UX wise.

---

### 5. Retry logic for when duration is not ready yet

```js
} else if (attempt < 35) {
  setTimeout(() => tryGetDuration(attempt + 1), 150);
} else {
  setWaitingForVideo(false);
  setVideoError(true);
}
```

**What it does**

* `else if (attempt < 35)`
  If the duration is not valid yet and you have tried fewer than 35 times:

  * `setTimeout(() => tryGetDuration(attempt + 1), 150);`
    Wait 150 ms and try again with `attempt + 1`.

* Rough timing:
  35 attempts * 150 ms ~= 5250 ms total possible wait.
  But in practice, the duration is usually ready much sooner.

* `else` (if we reached or passed 35 attempts):

  * `setWaitingForVideo(false);`
    Stop the spinner because we are giving up.
  * `setVideoError(true);`
    Flip the error flag so the UI can show something like “Could not detect video duration”.

**Why it matters**

You do not want an infinite loop if the user opens the popup on a page with no video, or the video never finishes loading. This retry pattern gives the page several chances, but eventually fails gracefully and tells the user instead of hanging forever.

---

```js
useEffect(() => {
  const listener = (message, sender, sendResponse) => {
    if (message.type === "TRANSCRIPT_READY") {
      if (message.description) {
        dispatch(setDescription(message.description));
        refetchUsage();
      }
      if (typeof message.transcript === "string") {
        clearTimeout(window._transcriptTimeout);
        dispatch(setLoading(false));
        dispatch(setTranscript(message.transcript));

        const language = message.language || "English";
        localStorage.setItem("lastTranscriptLanguage", language);

        if (message.transcript.length > 3000) {
          setTimestampError("");
          dispatch(
            setStatus("⚠️ Transcript too long! Try reducing time range.")
          );
        } else {
          setTimestampError("");
          dispatch(setStatus("✅ Transcript fetched! Ready to send."));
        }
      } else {
        dispatch(setStatus("❌ Failed to fetch transcript."));
        dispatch(setLoading(false));
      }
    }

    if (message.type === "YOUTUBE_TRANSCRIPT_DONE") {
      dispatch(setLoading(false));
      dispatch(setStatus("✅ Transcript sent to ChatGPT!"));

      refetch().then(({ data }) => {});

      setTimeout(() => dispatch(setStatus("")), 4000);

      chrome.tabs.query({}, (tabs) => {
        const matches = tabs.filter(
          (tab) => tab.url && tab.url.includes("chatgpt.com")
        );
        setChatTabs(matches);
      });
    }

    // ✅ Real-time usage count update
    if (message.type === "USAGE_INCREMENTED") {
      refetch(); // from useUsageCount
    }
  };

  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}, []);
```

---

### 1. Registering the message listener

```js
useEffect(() => {
  const listener = (message, sender, sendResponse) => { ... };

  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}, []);
```

**What it does**

* `useEffect(..., [])` runs once when the popup mounts.
* You define a `listener` function that will handle *all* messages your background / content scripts send to this popup.
* `chrome.runtime.onMessage.addListener(listener)` hooks your listener into the Chrome extension message bus.
* The cleanup `removeListener` in the return makes sure that if the popup unmounts / remounts, you don’t stack multiple listeners and get duplicate events.

**Why it matters**

This is how your popup reacts to *asynchronous events*:

* Whisper finished transcribing,
* background finished injecting into ChatGPT,
* usage count changed.

Without this listener, your front end would have no way to know what the background just did.

---

### 2. Handling `TRANSCRIPT_READY` (from background / content / Whisper server)

```js
if (message.type === "TRANSCRIPT_READY") {
  if (message.description) {
    dispatch(setDescription(message.description));
    refetchUsage();
  }
  if (typeof message.transcript === "string") {
    clearTimeout(window._transcriptTimeout);
    dispatch(setLoading(false));
    dispatch(setTranscript(message.transcript));

    const language = message.language || "English";
    localStorage.setItem("lastTranscriptLanguage", language);

    if (message.transcript.length > 3000) {
      setTimestampError("");
      dispatch(
        setStatus("⚠️ Transcript too long! Try reducing time range.")
      );
    } else {
      setTimestampError("");
      dispatch(setStatus("✅ Transcript fetched! Ready to send."));
    }
  } else {
    dispatch(setStatus("❌ Failed to fetch transcript."));
    dispatch(setLoading(false));
  }
}
```

**What it does**

This branch fires when your background/content/Whisper server sends a message like:

```js
chrome.runtime.sendMessage({
  type: "TRANSCRIPT_READY",
  transcript: "...",
  description: "...",
  language: "Spanish",
});
```

Breakdown:

* `if (message.description) { ... }`

  * If the background included a `description` (video description text, like for recipes/tutorials), you:

    * `dispatch(setDescription(message.description));`
      Store it in Redux so your UI can show or optionally include it later.
    * `refetchUsage();`
      Ask the usage hook to pull a fresh usage count, because a transcription may have updated limits.

* `if (typeof message.transcript === "string") { ... }`
  Only proceed if there’s actual transcript text.

  Inside:

  * `clearTimeout(window._transcriptTimeout);`
    Cancels any timeout you might have set earlier to detect “hanging” transcriptions. This says “we got the transcript in time.”

  * `dispatch(setLoading(false));`
    Turn off the spinner / loading state.

  * `dispatch(setTranscript(message.transcript));`
    Save the text into Redux. This also updates `charCount` via your slice.

  * Language memory:

    ```js
    const language = message.language || "English";
    localStorage.setItem("lastTranscriptLanguage", language);
    ```

    Stores the last detected or chosen language so the UI can:

    * Preselect language next time,
    * Or use it for default prompts.

  * Length check:

    ```js
    if (message.transcript.length > 3000) {
      setTimestampError("");
      dispatch(
        setStatus("⚠️ Transcript too long! Try reducing time range.")
      );
    } else {
      setTimestampError("");
      dispatch(setStatus("✅ Transcript fetched! Ready to send."));
    }
    ```

    * If transcript is very long (> 3000 chars), you warn the user:

      * Clear any previous timestamp error.
      * Set a status telling them to shrink the time range because ChatGPT or your prompt has practical limits.
    * Otherwise you say: “Transcript fetched, ready to send” and clear any timestamp error.

* `else { ... }`
  Fallback if `message.transcript` is missing or not a string:

  * Set the status to failure.
  * Turn loading off.

**Why it matters**

This is your “transcription finished” handler.
It:

* Moves UI from “loading…” to “here’s the text,”
* Saves description and language metadata,
* Keeps your usage and error messaging in sync with what actually happened.

---

### 3. Handling `YOUTUBE_TRANSCRIPT_DONE` (after sending to ChatGPT)

```js
if (message.type === "YOUTUBE_TRANSCRIPT_DONE") {
  dispatch(setLoading(false));
  dispatch(setStatus("✅ Transcript sent to ChatGPT!"));

  refetch().then(({ data }) => {});

  setTimeout(() => dispatch(setStatus("")), 4000);

  chrome.tabs.query({}, (tabs) => {
    const matches = tabs.filter(
      (tab) => tab.url && tab.url.includes("chatgpt.com")
    );
    setChatTabs(matches);
  });
}
```

**What it does**

This message is sent by your background script when it finishes injecting the transcript into a ChatGPT tab.

* `dispatch(setLoading(false));`
  Disable any “sending…” spinner.

* `dispatch(setStatus("✅ Transcript sent to ChatGPT!"));`
  Show a clear success banner in the popup.

* `refetch().then(({ data }) => {});`
  Triggers a fresh GraphQL query (from one of your hooks) to get up-to-date account info.
  Even though you’re not using `data` here, it’s keeping your subscription/usage state honest after a send.

* `setTimeout(() => dispatch(setStatus("")), 4000);`
  After 4 seconds, clear the status so your UI doesn’t stay green forever.

* `chrome.tabs.query({}, (tabs) => { ... })`

  * Requests all tabs.
  * Filters to `tab.url.includes("chatgpt.com")`.
  * `setChatTabs(matches);` saves the list of ChatGPT tabs.

**Why it matters**

This is the second half of your “UX story”:

1. `TRANSCRIPT_READY` → “We got the text.”
2. `YOUTUBE_TRANSCRIPT_DONE` → “We successfully sent it into ChatGPT.”

And by updating `chatTabs`, you keep track of where you can send **future** transcripts or show the user a list of available ChatGPT sessions.

---

### 4. Handling `USAGE_INCREMENTED` (real-time meter updates)

```js
// ✅ Real-time usage count update
if (message.type === "USAGE_INCREMENTED") {
  refetch(); // from useUsageCount
}
```

**What it does**

When your backend or Whisper server finishes a transcription, it may send a message like:

```js
chrome.runtime.sendMessage({ type: "USAGE_INCREMENTED" });
```

This effect listens for that and responds by:

* `refetch();`
  Calling the `refetch` from your usage hook (or subscription hook depending on which you passed in here) to reload usage stats from the GraphQL backend.

**Why it matters**

This gives you a live usage meter.
Instead of waiting for a full reload, your popup can show, in real time:

* “You’ve used X out of 8000 tokens this month,”
* And update it right after each Whisper call.

---

### 5. Big-picture summary for your docs


> This `useEffect` registers a single `chrome.runtime.onMessage` listener that reacts to messages from the background and content scripts. When a `TRANSCRIPT_READY` message arrives, the popup saves the transcript and optional video description to Redux, disables the loading spinner, remembers the language in `localStorage`, validates transcript length, and shows a status message. When a `YOUTUBE_TRANSCRIPT_DONE` message arrives, it confirms that the transcript was successfully injected into a ChatGPT tab, briefly shows a success banner, and refreshes the list of open ChatGPT tabs. Finally, when a `USAGE_INCREMENTED` message is received, it triggers a GraphQL refetch to update the user’s usage count in real time. Together, this turns background events (transcription, sending, billing) into live UI updates in the popup.

Here’s a clean, clear explanation of **exactly what this effect does and why it matters in your extension’s architecture.**
This one is important because it controls *how your popup remembers which ChatGPT tab to send transcripts to.*

---

# 🧩 What This Effect Does

```js
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
```

---

# ✅ Part 1: Find all open ChatGPT tabs

```js
chrome.tabs.query({}, (tabs) => {
  const matches = tabs.filter(
    (tab) => tab.url && tab.url.includes("chatgpt.com")
  );
  setChatTabs(matches);
});
```

### ✔ What it does

* When the popup opens, it looks through **all browser tabs**.
* It filters tabs whose URL contains `"chatgpt.com"`.
* The result is stored in `chatTabs`.

### ✔ Why this matters

Your popup needs to know **which ChatGPT tab to send transcripts to**.

Real examples:

* User has ChatGPT open in two windows → you show both as choices.
* User has no ChatGPT tab open → your UI can show “No ChatGPT tab found.”

This gives your popup the list of target tabs that your background script will message later.

### ✔ Without this…

Your extension wouldn’t know where to send the transcript.
It would always guess, or worse, fail silently.

---

# ✅ Part 2: Restore which ChatGPT tab the user selected last time

```js
chrome.storage.local.get("selectedChatTabId", ({ selectedChatTabId }) => {
  if (selectedChatTabId) {
    setSelectedTabId(selectedChatTabId);
  }
});
```

### ✔ What it does

* Reads `selectedChatTabId` from Chrome’s local storage.
* If it exists, restores it into state.

### ✔ Why this matters

This gives your extension **memory** between popup opens.

Example:

* User chooses ChatGPT tab #3 earlier,
* Closes popup,
* Reopens it later → **your extension remembers the choice**.

Better UX:

* No need to select a target tab every time.
* You can auto-send the transcript to the last used tab.

### ✔ Without this…

Every time the popup opens, the user would need to pick a ChatGPT tab again.
This makes the workflow slower and more annoying.

---

# 🧠 Why this effect runs only once (`[]`)

Because you only need to perform this logic **when the popup first loads**:

* Lists tabs once
* Restores selection once
* Doesn’t re-run unnecessarily

If you re-ran it every render:

* you’d trigger too many `chrome.tabs.query` calls
* it would slow down the popup
* it would reset state constantly

---

### **Effect: Load ChatGPT Tabs and Restore Selected Tab**

This effect runs once when the popup opens. It performs two tasks:

1. **Discover all open ChatGPT tabs**
   Using `chrome.tabs.query`, the popup collects every tab whose URL includes `"chatgpt.com"`.
   This list is stored in `chatTabs` and used to let the user choose which ChatGPT tab should receive the transcript.

2. **Restore the previously selected ChatGPT tab**
   The extension reads `selectedChatTabId` from `chrome.storage.local`.
   If present, it restores that value into state so the user doesn’t need to pick a ChatGPT tab every time the popup opens.

This provides smoother UX and ensures the transcript is always sent to the correct ChatGPT window.

---

# 🧩 What This Effect Does

```js
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
```

---

# 🧠 High-Level Summary

This effect keeps **two different timestamp systems in sync**:

* The popup has **text inputs** (`startTime`, `endTime`)
* It also has a **slider UI** (`sliderStart`, `sliderEnd`)

A user can change **either**, but the app must keep them synchronized so your slicing logic works perfectly.

This effect updates the slider values *whenever the typed times change* — but only when the values are valid.

---

# 🔍 Line-by-Line Explanation

### **1. Convert start time from “mm:ss” → seconds**

```js
const newStart = parseTimeToSeconds(startTime);
```

* Converts `"02:15"` into `135`
* Returns `null` if invalid (ex: `"2:5"` or `"abc"`)

---

### **2. Validate and update sliderStart**

```js
if (
  newStart !== null &&
  newStart !== sliderStart &&
  newStart < videoDuration
) {
  setSliderStart(newStart);
}
```

This ensures:

#### ✔ The time is valid

`newStart !== null`

#### ✔ It’s different (prevents infinite loops)

`newStart !== sliderStart`

Otherwise changing sliderStart would recreate the same effect endlessly.

#### ✔ It’s inside the video duration

`newStart < videoDuration`

Prevents times like `00:99` or `12:00` on a 9-minute video.

#### ✔ If all checks pass → update slider position

`setSliderStart(newStart)`

---

### **3. Same exact logic for the end time**

```js
const newEnd = parseTimeToSeconds(endTime);
if (newEnd !== null && newEnd !== sliderEnd && newEnd <= videoDuration) {
  setSliderEnd(newEnd);
}
```

Only difference → end time can equal video duration (allowed):

`newEnd <= videoDuration`

---

# 🎯 Why This Effect Exists

Because your UI has **two different controls** for timestamps:

1. **A text input** (`startTime`, `endTime`)
2. **A draggable slider** (`sliderStart`, `sliderEnd`)

Without this effect:

* The typed time might not match the slider
* The slider could show outdated values
* The user could type invalid times and break slicing
* Whisper slicing could cut the wrong portion

This effect ensures:

### 👉 Whatever the user types is always reflected in the slider

### 👉 Only valid inputs update the slider

### 👉 No infinite re-renders

### 👉 Timestamps never exceed video length

This is the brain behind making your timestamp UI feel smooth and reliable.

---

**Effect: Sync Text Inputs With Slider Controls**

This effect listens for changes to `startTime`, `endTime`, or `videoDuration`.
When the user types a timestamp manually (e.g., “02:30”), it:

1. Converts it to seconds
2. Validates it
3. Ensures it differs from the current slider value
4. Updates the slider range (`sliderStart` / `sliderEnd`)

Invalid values are ignored so the slider never jumps to impossible positions.
This keeps the **slider UI** and **typed timestamps** perfectly synchronized while preventing infinite loops and invalid ranges.

---

