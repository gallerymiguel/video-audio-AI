import { useState } from "react";
import { useMutation, gql } from "@apollo/client";

const REQUEST_PASSWORD_RESET = gql`
  mutation RequestPasswordReset($email: String!) {
    requestPasswordReset(email: $email)
  }
`;

export default function ForgotPasswordForm({ onBack }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [requestReset, { loading, error }] = useMutation(REQUEST_PASSWORD_RESET);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(""); // Clear previous message
    try {
      const { data } = await requestReset({ variables: { email } });
      setMessage(data.requestPasswordReset);
    } catch (err) {
      console.error("Error:", err.message);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md mx-auto p-6 bg-white space-y-4"
    >
      <h2 className="text-2xl font-bold text-center">Reset Password</h2>

      <input
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        required
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition"
      >
        {loading ? "Sending..." : "Send Reset Link"}
      </button>

      {message && <p className="text-green-600 text-sm">{message}</p>}
      {error && <p className="text-red-500 text-sm">⚠️ {error.message}</p>}

      <button
        type="button"
        onClick={onBack}
        className="text-sm text-blue-500 hover:underline mt-2"
      >
        Back to Login
      </button>
    </form>
  );
}
