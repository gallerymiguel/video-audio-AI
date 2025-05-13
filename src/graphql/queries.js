import { gql } from "@apollo/client";

export const CHECK_SUBSCRIPTION_STATUS = gql`
  query CheckSubscriptionStatus {
    checkSubscriptionStatus
  }
`;

export const CHECK_SUBSCRIPTION_QUERY = gql`
  query CheckSubscription {
    me {
      id
      email
      subscription {
        active
        plan
        expiresAt
      }
    }
  }
`;

export const START_SUBSCRIPTION = gql`
  mutation StartSubscription {
    startSubscription
  }
`;

export const GET_USAGE_COUNT = gql`
  query GetUsageCount {
    getUsageCount
  }
`;