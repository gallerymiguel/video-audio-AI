# **useSubscriptionStatus(authToken) — Documentation**

This custom hook checks the user’s subscription status by calling your GraphQL backend through Apollo Client. It also automatically re-checks the status whenever the user logs in.

---

## **1. Imports**

```js
import { useQuery, useApolloClient } from "@apollo/client";
import { CHECK_SUBSCRIPTION_STATUS } from "../graphql/queries";
import { useEffect } from "react";
import { START_SUBSCRIPTION } from "../graphql/mutations";
import { useMutation } from "@apollo/client";
```

### **What these imports are for**

* **useQuery**
  Runs GraphQL queries inside React.

* **useApolloClient** *(not used in this specific hook but imported for nearby logic)*
  Gives access to the low-level Apollo client when needed.

* **CHECK_SUBSCRIPTION_STATUS**
  A GraphQL query from your frontend queries file.
  It returns whether the logged-in user’s subscription is active.

* **useEffect**
  Lets the hook re-check subscription status after login.

* **START_SUBSCRIPTION / useMutation**
  Used in a separate hook below this one — not used in this function, but part of the same file.

---

# **2. Hook: useSubscriptionStatus(authToken)**

```js
export default function useSubscriptionStatus(authToken) {
  const { data, loading, error, refetch } = useQuery(
    CHECK_SUBSCRIPTION_STATUS,
    {
      fetchPolicy: "network-only",
      skip: !authToken,
    }
  );
```

### **What this section does**

### **useQuery() runs the GraphQL request**

It calls:

```graphql
query {
  checkSubscriptionStatus
}
```

and returns:

* **data** — the result `{ checkSubscriptionStatus: true/false }`
* **loading** — true while the request is running
* **error** — any errors returned by GraphQL or the network
* **refetch** — a function that manually re-runs the query

---

### **fetchPolicy: "network-only"**

This forces Apollo to always ask the backend directly.

You chose this because:

* Subscription status can change at any time due to **Stripe webhooks**
* You cannot trust cached data
* The popup UI must always show the **real status**

This is the correct approach for billing-related queries.

---

### **skip: !authToken**

If the user is **not logged in**, the query is skipped entirely.

This prevents:

* Unauthorized errors from the backend
* Unnecessary network calls
* Useless loading states

The hook remains idle until the user logs in.

---

# **3. Auto-refetch on login**

```js
  useEffect(() => {
    if (authToken) {
      refetch(); // force re-run after login
    }
  }, [authToken]);
```

### **Why this exists**

When the user logs in, the popup receives a new JWT auth token.
Without this effect, Apollo wouldn’t automatically re-check subscription status.

This line ensures:

* As soon as the user logs in
* The hook forcefully re-runs the GraphQL query
* The UI immediately shows their correct subscription state

It prevents the “still showing inactive after login” bug.

---

# **4. Hook Return Value**

```js
  return {
    isSubscribed: data?.checkSubscriptionStatus === true,
    loading,
    error,
    refetch,
  };
}
```

### **What each return value means**

#### **isSubscribed**

* True if the backend reports an active subscription
* False otherwise
* Safely handles undefined data on first load

#### **loading**

Used to show spinners or disable premium features while checking.

#### **error**

Lets the UI handle:

* User not logged in
* Network problems
* Backend issues

#### **refetch**

Components can manually refresh subscription status, for example:

```js
await refetch(); // after Stripe checkout completion
```

This is essential for instant subscription unlocking.

---

# **Summary**

> **useSubscriptionStatus(authToken)** is a custom hook that checks whether the logged-in user has an active subscription. It sends a GraphQL query to the backend with `useQuery`, forces network-only fetching to avoid stale Stripe data, skips execution when no JWT is present, and automatically refetches when the auth token changes. It returns the subscription state (`isSubscribed`), any loading/error states, and a manual `refetch` function so premium UI elements can instantly refresh after checkout or login.

---

# **useStartSubscription() — Documentation**

This custom hook handles the frontend side of starting a paid subscription through Stripe Checkout. It sends a GraphQL mutation to your backend, waits for the Stripe Checkout URL, and then opens it in a new browser tab.

---

## **1. Imports (implied)**

```js
import { useMutation } from "@apollo/client";
import { START_SUBSCRIPTION } from "../graphql/mutations";
```

### **Why these matter**

* **useMutation** lets you run GraphQL mutations inside components.
* **START_SUBSCRIPTION** is the mutation document that calls:

```graphql
mutation {
  startSubscription
}
```

Your backend resolver returns a **Stripe Checkout URL**, not a boolean or token.
That URL is what opens the Stripe payment page.

---

# **2. The Hook Definition**

```js
export function useStartSubscription() {
  const [startSubscription, { loading, error }] =
    useMutation(START_SUBSCRIPTION);
```

### **What this line does**

### **useMutation(START_SUBSCRIPTION)** returns:

1. a function called **startSubscription()**
2. mutation state:

   * **loading** — true while the mutation is running
   * **error** — GraphQL or network errors

This means:

* When the user clicks “Upgrade,”
  your UI will call `startSubscription()`,
  which automatically sends the mutation to your backend.

---

# **3. The initiateCheckout function**

```js
  const initiateCheckout = async () => {
    try {
      const result = await startSubscription();
      const url = result?.data?.startSubscription;
      if (url) {
        window.open(url, "_blank");
      } else {
        console.error("❌ No Stripe URL returned.");
      }
    } catch (err) {
      console.error("❌ Stripe mutation failed:", err.message);
    }
  };
```

### **Step-by-step breakdown**

### **(1) You call startSubscription()**

This triggers your GraphQL resolver:

```graphql
mutation {
  startSubscription
}
```

The resolver builds a Stripe Checkout Session and returns the **checkout URL**.

---

### **(2) Await the mutation result**

```js
const result = await startSubscription();
```

This result looks like:

```js
{
  data: {
    startSubscription: "https://checkout.stripe.com/pay/session_id..."
  }
}
```

---

### **(3) Extract the URL**

```js
const url = result?.data?.startSubscription;
```

Optional chaining ensures you don't crash if something is missing.

---

### **(4) Open Stripe Checkout**

```js
if (url) {
  window.open(url, "_blank");
}
```

This launches the real Stripe payment page in a new tab.
This is exactly how Chrome extensions initiate Stripe billing safely:
the backend creates the session, the frontend only opens the URL.

---

### **(5) Handle error cases**

* Missing URL
* Misconfigured Stripe credentials
* Network errors
* Mutations failing

Your error console logs help you debug all these.

---

# **4. Return Value**

```js
  return { initiateCheckout, loading, error };
}
```

### **Returned to components:**

| Returned Value       | What It Does                                              |
| -------------------- | --------------------------------------------------------- |
| **initiateCheckout** | Function components call to start the Stripe payment flow |
| **loading**          | UI can show “Loading…” or disable Subscribe button        |
| **error**            | UI can show “Subscription failed” messages                |

This separation is clean and React-friendly.

---

# **Summary (for your docs)**

> **useStartSubscription()** is a custom React hook that triggers the Stripe subscription workflow. It sends the `startSubscription` GraphQL mutation to the backend, receives the Stripe checkout URL, and opens it in a new browser tab. The hook exposes `initiateCheckout` to the UI plus status flags (`loading`, `error`) so the UI can show spinners or error messages. This isolates billing logic into a clean, reusable hook.

---



