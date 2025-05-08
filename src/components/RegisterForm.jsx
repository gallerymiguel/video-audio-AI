import React, { useState } from "react";
import { useMutation } from "@apollo/client";
import { REGISTER_MUTATION } from "../../graphql/mutations";

const RegisterForm = () => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [register, { loading, error, data }] = useMutation(REGISTER_MUTATION);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const result = await register({ variables: formData });
      const token = result.data.register;
      localStorage.setItem("token", token);
      alert("✅ Registered successfully!");
    } catch (err) {
      console.error("Registration error:", err);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md mx-auto p-6 bg-white shadow-md rounded-xl space-y-4"
    >
      <h2 className="text-2xl font-bold text-center">Create an Account</h2>

      <input
        name="email"
        type="email"
        placeholder="Email"
        value={formData.email}
        onChange={handleChange}
        className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        required
      />

      <input
        name="password"
        type="password"
        placeholder="Password"
        value={formData.password}
        onChange={handleChange}
        className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        required
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition"
      >
        {loading ? "Registering..." : "Register"}
      </button>

      {error && <p className="text-red-500 text-sm">⚠️ {error.message}</p>}
    </form>
  );
};

export default RegisterForm;
