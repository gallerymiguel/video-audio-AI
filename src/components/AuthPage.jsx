import React, { useState } from "react";
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";
import ForgotPasswordForm from "./ForgotPasswordForm"; // Add this import

const AuthPage = ({ onLoginSuccess, onClose }) => {
  const [view, setView] = useState("login"); // 'login' | 'register' | 'forgot'

  return (
    <div className="relative bg-white p-4 rounded-lg shadow-md">
      {/* ❌ Close button */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-gray-500 hover:text-black"
      >
        ❌
      </button>

      {/* Render the current form based on view */}
      {view === "login" && (
        <LoginForm
          onLoginSuccess={onLoginSuccess}
          onForgotPassword={() => setView("forgot")}
        />
      )}

      {view === "register" && (
        <RegisterForm onLoginSuccess={onLoginSuccess} />
      )}

      {view === "forgot" && (
        <ForgotPasswordForm
          onBack={() => setView("login")} // Add a back button in the form
        />
      )}

      {/* Toggle between Login/Register */}
      {view !== "forgot" && (
        <button
          onClick={() =>
            setView((prev) => (prev === "login" ? "register" : "login"))
          }
          className="mt-4 text-blue-600 hover:underline"
        >
          {view === "login"
            ? "Don't have an account? Register"
            : "Already have an account? Login"}
        </button>
      )}
    </div>
  );
};

export default AuthPage;
