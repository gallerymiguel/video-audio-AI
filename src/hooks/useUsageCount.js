import { useQuery } from "@apollo/client";
import { GET_USAGE_COUNT } from "../graphql/queries";

export default function useUsageCount() {
  const { data, loading, error, refetch } = useQuery(GET_USAGE_COUNT, {
    fetchPolicy: "network-only",
  });

  return {
    usageCount: data?.getUsageCount || 0,
    loading,
    error,
    refetch,
  };
}

module.exports = useUsageCount;
