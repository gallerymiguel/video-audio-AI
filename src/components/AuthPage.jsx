import React, { useState } from "react";
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";

const AuthPage = ({ onLoginSuccess, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="relative bg-white p-4 rounded-lg shadow-md">
      {/* ❌ Close button */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-gray-500 hover:text-black"
      >
        ❌
      </button>

      {isLogin ? (
        <LoginForm onLoginSuccess={onLoginSuccess} />
      ) : (
        <RegisterForm onLoginSuccess={onLoginSuccess} />
      )}

      <button
        onClick={() => setIsLogin(!isLogin)}
        className="mt-4 text-blue-600 hover:underline"
      >
        {isLogin ? "Don't have an account? Register" : "Already have an account? Login"}
      </button>
    </div>
  );
};

export default AuthPage;
