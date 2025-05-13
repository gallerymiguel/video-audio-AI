import { useQuery, useApolloClient } from "@apollo/client";
import { CHECK_SUBSCRIPTION_STATUS } from "../graphql/queries";
import { useEffect } from "react";
import { START_SUBSCRIPTION } from "../graphql/mutations";
import { useMutation } from "@apollo/client";

// ✅ Hook 1: Check subscription with live refetch
export default function useSubscriptionStatus(authToken) {
  const { data, loading, error, refetch } = useQuery(
    CHECK_SUBSCRIPTION_STATUS,
    {
      fetchPolicy: "network-only",
      skip: !authToken,
    }
  );

  // 🔁 Automatically refetch when authToken changes
  useEffect(() => {
    if (authToken) {
      refetch(); // force re-run after login
    }
  }, [authToken]);

  return {
    isSubscribed: data?.checkSubscriptionStatus === true,
    loading,
    error,
    refetch,
  };
}

// ✅ Hook 2: Trigger Stripe Checkout
export function useStartSubscription() {
  const [startSubscription, { loading, error }] =
    useMutation(START_SUBSCRIPTION);

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

  return { initiateCheckout, loading, error };
}
