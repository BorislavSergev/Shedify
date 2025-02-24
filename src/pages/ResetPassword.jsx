import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import supabase from "../hooks/supabase"; // Adjust the path if necessary
import { useLanguage } from "../contexts/LanguageContext"; // Add language context

const ResetPassword = () => {
  const [email, setEmail] = useState("");
  const [errorMessages, setErrorMessages] = useState([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { translate } = useLanguage(); // Add language context

  useEffect(() => {
    // Cleanup function to reset messages on component unmount
    return () => {
      setErrorMessages([]);
      setSuccessMessage("");
    };
  }, []);

  const handleChange = (e) => {
    setEmail(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessages([]);
    setSuccessMessage("");

    if (!email) {
      setErrorMessages([translate("EMAIL_REQUIRED")]);
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email);

      if (error) throw error;

      setSuccessMessage(translate("RESET_LINK_SENT"));
    } catch (error) {
      console.error('Reset password error:', error);
      setErrorMessages([error.message || translate("RESET_FAILED")]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen justify-center items-center bg-primary">
      <div className="w-full max-w-md p-8 bg-white shadow-lg rounded-lg">
        <h2 className="text-2xl font-bold text-center mb-6">{translate("RESET_PASSWORD")}</h2>
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
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2" htmlFor="email">
              {translate("EMAIL")}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={handleChange}
              placeholder={translate("ENTER_EMAIL")}
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
            {loading ? translate("SENDING...") : translate("SEND_RESET_LINK")}
          </button>
        </form>
        
        <div className="mt-4 text-center">
          <p className="text-gray-600">
            {translate("BACK_TO_LOGIN")}{" "}
            <Link to="/login" className="text-accent hover:underline">
              {translate("LOGIN")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword; 