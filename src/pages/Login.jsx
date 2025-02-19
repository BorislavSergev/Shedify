import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../hooks/supabase"; // Adjust the path if necessary

const Login = () => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errorMessages, setErrorMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessages([]);

    if (!formData.email || !formData.password) {
      setErrorMessages(["Email and password are required."]);
      return;
    }

    try {
      setLoading(true);

      // Supabase email/password login
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) {
        throw error;
      }

      // Check if the email is confirmed
      if (!data.user.email_confirmed_at) {
        // Redirect to verify email if not confirmed
        navigate("/verify-email");
        return;
      }

      // Now check if the user exists in the BusinessTeam table
      const { data: businessTeamData, error: teamError } = await supabase
        .from("BusinessTeam")
        .select("*")
        .eq("userId", data.user.id)
        .single(); // This will get the first matching row

      if (teamError || !businessTeamData) {
        // If the user does not exist in the BusinessTeam table, redirect to /create-business
        window.location.href = "/create-business"; // Use window.location.href for immediate redirection


      } else {
        // If the user exists in the BusinessTeam table, redirect to /dashboard
        window.location.href = "/dashboard"; // Use window.location.href for immediate redirection

      }
    } catch (error) {
      setErrorMessages([error.message || "Unable to log in. Please try again."]);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="flex h-screen justify-center items-center bg-primary">
      <div className="w-full max-w-md p-8 bg-white shadow-lg rounded-lg">
        <h2 className="text-2xl font-bold text-center mb-6">Sign In</h2>
        {errorMessages.length > 0 && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
            {errorMessages.map((msg, idx) => (
              <p key={idx}>{msg}</p>
            ))}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <button
            type="submit"
            className={`w-full py-2 rounded-md text-white ${loading ? "bg-gray-400 cursor-not-allowed" : "bg-accent hover:bg-accentHover"}`}
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
