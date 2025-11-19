# 📘 **Documentation: useUsageCount.js**

### **📌 File Purpose**

`useUsageCount` is a custom React hook that retrieves the user’s current API usage from your GraphQL backend. It allows your Chrome extension UI to dynamically display:

* how many tokens the user has spent
* whether they’re near their limit
* whether they should be blocked from starting a new transcription

This hook is one of the bridges between your **frontend popup UI** and your **GraphQL backend**.

---

# 🔍 **Line-by-line Explanation**

## **1. Import dependencies**

```js
import { useQuery } from "@apollo/client";
import { GET_USAGE_COUNT } from "../graphql/queries";
```

* `useQuery` — Apollo Client hook used for running GraphQL queries in React.
* `GET_USAGE_COUNT` — a GraphQL query you defined in `/graphql/queries.js`.

This means the hook doesn't hard-code anything; it just runs the query you declared elsewhere. Clean separation.

---

## **2. Hook Definition**

```js
export default function useUsageCount() {
```

This creates a reusable hook that ANY part of your UI can call:

* App.jsx
* SettingsPanel
* Upgrade popups
* Usage warnings

Anywhere you need the user’s token usage, you call this hook.

---

## **3. Run the GraphQL Query**

```js
const { data, loading, error, refetch } = useQuery(GET_USAGE_COUNT, {
  fetchPolicy: "network-only",
});
```

This is the heart of the hook.

### **What this does:**

* Runs the GraphQL query `{ getUsageCount }` as soon as the hook loads.
* Returns 4 important values:

| Name      | Meaning                                                       |
| --------- | ------------------------------------------------------------- |
| `data`    | The actual result from the backend (`{ getUsageCount: 300 }`) |
| `loading` | `true` while the query is in-flight                           |
| `error`   | Contains error info if query failed                           |
| `refetch` | A function to manually re-run the query                       |

### **Why `fetchPolicy: "network-only"` matters**

You are telling Apollo:

> “Do **not** use cached values. Always hit the backend.”

This is important for your app because usage count changes every time:

* a transcription finishes
* the backend increments usage
* a subscription resets usage monthly

If Apollo cached it, the UI would show wrong values.

This ensures **live accuracy**.

---

## **4. Return a simple object**

```js
return {
  usageCount: data?.getUsageCount || 0,
  loading,
  error,
  refetch,
};
```

This normalizes your data so your UI has a simple API:

* If data is missing, fall back to `0` so nothing crashes.
* Exposes the ability to refresh usage data on demand.

### Example usage in App.jsx:

```js
const { usageCount, loading, refetch } = useUsageCount();
```

Now your UI can:

* show a usage bar
* block transcription if tokens exceeded
* show a toast warning
* refresh usage after a transcription finishes

---

# 🧠 **Why This Hook Matters**

This hook is a key part of your extension’s **token enforcement system**.

Here’s the full flow:

1. Frontend calls `useUsageCount()`
2. GraphQL backend returns token usage
3. App UI shows usage or blocks transcription
4. Whisper server estimates new tokens
5. Whisper server calls mutation `incrementUsage()`
6. Back to frontend → you call `refetch()` to update UI

This hook keeps the **UI accurate** and prevents users from bypassing your limits.

---

# ✔️ Summary

> `useUsageCount()` is a custom Apollo hook that fetches the user’s real-time usage count from the GraphQL backend, bypassing cache, and gives the extension a simple interface for displaying and updating token usage inside the UI.

---

