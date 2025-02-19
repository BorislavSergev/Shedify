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

    if (!formData.email || !formData.password) {
      setErrorMessages(["Имейл и парола са задължителни"]);
      return;
    }

    try {
      setLoading(true);

      // First, attempt login
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (authError) throw authError;

      // Check if email is confirmed
      if (!authData.user.email_confirmed_at) {
        navigate("/verify-email");
        return;
      }

      // Show loading message
      setErrorMessages(["Зареждане на данните..."]);

      // Critical: Wait for auth session to be fully established
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify session is set
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        throw new Error("Session not established");
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
      setErrorMessages(["Подготовка на таблото..."]);

      // Select the first business and store it
      const firstBusiness = {
        id: businessTeamData[0].Business.id,
        name: businessTeamData[0].Business.name,
        planId: businessTeamData[0].Business.planId
      };
      
      // Store the first business immediately
      localStorage.setItem("selectedBusiness", JSON.stringify(firstBusiness));

      // Update loading message
      setErrorMessages(["Зареждане на плана..."]);

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
      setErrorMessages(["Пренасочване към таблото..."]);

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
      setErrorMessages([error.message || "Неуспешно влизане. Моля, опитайте отново."]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen justify-center items-center bg-primary">
      <div className="w-full max-w-md p-8 bg-white shadow-lg rounded-lg">
        <h2 className="text-2xl font-bold text-center mb-6">Вход</h2>
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
              Имейл
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Въведете вашия имейл"
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2" htmlFor="password">
              Парола
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Въведете вашата парола"
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
            {loading ? "Влизане..." : "Влез"}
          </button>
        </form>
        
        {/* Add registration link */}
        <div className="mt-4 text-center">
          <p className="text-gray-600">
            Нямате акаунт?{" "}
            <Link to="/register" className="text-accent hover:underline">
              Регистрирайте се
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
