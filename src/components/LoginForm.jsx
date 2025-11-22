import React, { useState, useEffect } from "react";
import { useMutation } from "@apollo/client";
import { LOGIN_MUTATION } from "../graphql/mutations"; // Adjust path as needed

const LoginForm = ({ onLoginSuccess, onForgotPassword }) => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [rememberMe, setRememberMe] = useState(false);
  const [login, { loading, error }] = useMutation(LOGIN_MUTATION);

  // Load remembered credentials from chrome storage on mount
  useEffect(() => {
    chrome.storage.local.get(
      ["rememberedEmail", "rememberedPassword"],
      (result) => {
        if (result.rememberedEmail || result.rememberedPassword) {
          setFormData({
            email: result.rememberedEmail || "",
            password: result.rememberedPassword || "",
          });
          setRememberMe(true);
        }
      }
    );
  }, []);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const result = await login({ variables: formData });
      const token = result.data.login;
      if (token) {
        localStorage.setItem("token", token);
        window.dispatchEvent(new Event("authChange"));
        chrome.storage.local.set({ token });
        if (rememberMe) {
          chrome.storage.local.set({
            rememberedEmail: formData.email,
            rememberedPassword: formData.password,
          });
        } else {
          chrome.storage.local.remove([
            "rememberedEmail",
            "rememberedPassword",
          ]);
        }

        onLoginSuccess(token); // Notify parent of success
      } else {
        console.error("No token received");
      }
    } catch (err) {
      console.error("Login error:", err);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md mx-auto p-6 bg-white space-y-4"
    >
      <h2 className="text-2xl font-bold text-center">Login</h2>

      {/* Email Input */}
      <input
        name="email"
        type="email"
        placeholder="Email"
        value={formData.email}
        onChange={handleChange}
        className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        required
      />

      {/* Password Input */}
      <input
        name="password"
        type="password"
        placeholder="Password"
        value={formData.password}
        onChange={handleChange}
        className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        required
      />

      {/* Remember Me */}
      <label className="flex items-center space-x-2 text-sm">
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={() => setRememberMe(!rememberMe)}
          className="w-4 h-4"
        />
        <span>Remember Me</span>
      </label>

      {/* Login Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition"
      >
        {loading ? "Logging in..." : "Login"}
      </button>

      {/* Forgot Password Link */}
      <button
        type="button"
        onClick={onForgotPassword}
        className="text-sm text-blue-500 hover:underline mt-2"
      >
        Forgot Password?
      </button>

      {error && <p className="text-red-500 text-sm">⚠️ {error.message}</p>}
    </form>
  );
};

export default LoginForm;
