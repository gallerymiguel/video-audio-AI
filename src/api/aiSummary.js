function getApiBaseUrl() {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "");
  }

  const graphqlUrl = import.meta.env.VITE_GRAPHQL_URL;
  if (graphqlUrl) {
    return graphqlUrl.replace(/\/graphql\/?$/, "");
  }

  return "http://localhost:4000";
}

export async function generateAiSummary(payload, token) {
  const response = await fetch(`${getApiBaseUrl()}/api/ai/summarize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "Failed to generate AI summary.");
  }

  return data;
}
