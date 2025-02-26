import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import supabase from "../hooks/supabase"; // Adjust the path if necessary
import { useLanguage } from "../contexts/LanguageContext"; // Add language context

const ResetPassword = () => {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessages, setErrorMessages] = useState([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const navigate = useNavigate();
  const { translate } = useLanguage(); // Add language context

  useEffect(() => {
    // Check if we're in password recovery mode
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsResetMode(true);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Cleanup function to reset messages on component unmount
    return () => {
      setErrorMessages([]);
      setSuccessMessage("");
    };
  }, []);

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setErrorMessages([]);
    
    if (newPassword !== confirmPassword) {
      setErrorMessages([translate("PASSWORDS_DO_NOT_MATCH")]);
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessages([translate("PASSWORD_TOO_SHORT")]);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        setErrorMessages([error.message]);
      } else {
        setSuccessMessage(translate("PASSWORD_UPDATED_SUCCESSFULLY"));
        setTimeout(() => {
          navigate("/login");
        }, 2000);
      }
    } catch (error) {
      setErrorMessages([error.message]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetLink = async (e) => {
    e.preventDefault();
    setErrorMessages([]);
    setSuccessMessage("");

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailPattern.test(email)) {
      setErrorMessages([translate("invalidEmail")]);
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `https://shedify.eu/reset-password`
      });

      if (error) {
        console.error('Error sending recovery email:', error);
        setErrorMessages([error.message]);
        return;
      }

      setSuccessMessage(translate("resetLinkSent"));
      setEmail("");
    } catch (error) {
      console.error('Reset password error:', error);
      setErrorMessages([error.message]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen justify-center items-center bg-primary">
      <div className="w-full max-w-md p-8 bg-white shadow-lg rounded-lg">
        <h2 className="text-2xl font-bold text-center mb-6">
          {isResetMode ? translate("setNewPassword") : translate("resetPassword")}
        </h2>
        
        {errorMessages.length > 0 && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
            {errorMessages.map((msg, idx) => (
              <p key={idx}>{msg}</p>
            ))}
          </div>
        )}
        
        {successMessage && (
          <div className="bg-green-100 text-green-700 p-3 rounded mb-4">
            <p>{successMessage}</p>
          </div>
        )}

        {isResetMode ? (
          // Password Reset Form
          <form onSubmit={handlePasswordReset}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" htmlFor="newPassword">
                {translate("newPassword")}
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                minLength={6}
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" htmlFor="confirmPassword">
                {translate("confirmPassword")}
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              className={`w-full py-2 rounded-md text-white ${
                loading ? "bg-gray-400 cursor-not-allowed" : "bg-accent hover:bg-accentHover"
              }`}
              disabled={loading}
            >
              {loading ? translate("updating") : translate("updatePassword")}
            </button>
          </form>
        ) : (
          // Send Reset Link Form
          <form onSubmit={handleSendResetLink}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" htmlFor="email">
                {translate("email")}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={translate("enterEmail")}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <button
              type="submit"
              className={`w-full py-2 rounded-md text-white ${
                loading ? "bg-gray-400 cursor-not-allowed" : "bg-accent hover:bg-accentHover"
              }`}
              disabled={loading}
            >
              {loading ? translate("sending") : translate("sendResetLink")}
            </button>
          </form>
        )}
        
        <div className="mt-4 text-center">
          <p className="text-gray-600">
            {translate("backToLogin")}{" "}
            <Link to="/login" className="text-accent hover:underline">
              {translate("login")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword; 