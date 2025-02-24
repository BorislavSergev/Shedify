import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import supabase from "../hooks/supabase"; // Adjust the path if necessary
import { useLanguage } from "../contexts/LanguageContext"; // Add language context

const Login = () => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errorMessages, setErrorMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { translate } = useLanguage(); // Add language context

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

    // New validation for invalid email format
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Simple email regex
    if (!emailPattern.test(formData.email)) {
      setErrorMessages([translate("invalidEmail")]);
      return;
    }

    if (!formData.email || !formData.password) {
      setErrorMessages([translate("email_password_required")]);
      return;
    }

    try {
      setLoading(true);

      // First, attempt login
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });
      if (authError.message == "Invalid login credentials") {
        setErrorMessages([translate("invalid_login_credentials")]);
        return; // Exit early if there's an error
      }else{
        setErrorMessages([translate("login_failed")]);
      }

      // Check if email is confirmed
      if (!authData.user.email_confirmed_at) {
        navigate("/verify-email");
        return;
      }

      // Show loading message
      setErrorMessages([translate("LOADING_DATA")]);

      // Critical: Wait for auth session to be fully established
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify session is set
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        throw new Error(translate("login_failed"));
      }

      // Fetch business teams with business details
      const { data: businessTeamData, error: teamError } = await supabase
        .from("BusinessTeam")
        .select(`
          id,
          businessId,
          Business (
            id,
            name,
            planId
          )
        `)
        .eq("userId", authData.user.id);

      if (teamError) throw teamError;

      // Check if user has any business teams
      if (!businessTeamData || businessTeamData.length === 0) {
        navigate("/create-business");
        return;
      }

      // Update loading message
      setErrorMessages([translate("preparing_dashboard")]);

      // Select the first business and store it
      const firstBusiness = {
        id: businessTeamData[0].Business.id,
        name: businessTeamData[0].Business.name,
        planId: businessTeamData[0].Business.planId
      };
      
      // Store the first business immediately
      localStorage.setItem("selectedBusiness", JSON.stringify(firstBusiness));

      // Update loading message
      setErrorMessages([translate("loading_plan")]);

      // Fetch the plan details
      const { data: planData, error: planError } = await supabase
        .from("Plans")
        .select("*")
        .eq("id", firstBusiness.planId)
        .single();

      if (!planError && planData) {
        localStorage.setItem("currentPlan", JSON.stringify(planData));
      }

      // Final loading message
      setErrorMessages([translate("redirecting_to_dashboard")]);

      // Navigate to dashboard
      navigate("/dashboard", { 
        state: { 
          freshLogin: true,
          businessData: firstBusiness,
          planData: planData,
          isLoading: true
        } 
      });

      // Wait 1.5 seconds then reload
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (error) {
      console.error('Login error:', error);
      setErrorMessages([error.message || translate("login_failed")]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen justify-center items-center bg-primary">
      <div className="w-full max-w-md p-8 bg-white shadow-lg rounded-lg">
        <h2 className="text-2xl font-bold text-center mb-6">{translate("login")}</h2>
        {errorMessages.length > 0 && (
          <div className={`p-3 rounded mb-4 ${
            loading ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"
          }`}>
            {errorMessages.map((msg, idx) => (
              <p key={idx}>{msg}</p>
            ))}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2" htmlFor="email">
              {translate("email")}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder={translate("enter_email")}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2" htmlFor="password">
              {translate("password")}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              placeholder={translate("enter_password")}
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
            {loading ? translate("logging_in") : translate("login")}
          </button>
        </form>
        
        <div className="mt-4 text-center">
          <p className="text-gray-600">
            {translate("no_account")}{" "}
            <Link to="/register" className="text-accent hover:underline">
              {translate("register")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
