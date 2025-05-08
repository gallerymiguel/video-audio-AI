import React, { useState } from "react";
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gray-100">
      {isLogin ? <LoginForm /> : <RegisterForm />}

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
