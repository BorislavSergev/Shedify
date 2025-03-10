import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../hooks/supabase"; // Adjust the path if necessary
import { FaEye, FaEyeSlash } from "react-icons/fa";

const Register = () => {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone_number: "",
    password: "",
  });
  const [errorMessages, setErrorMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inviteToken, setInviteToken] = useState(null);
  const [isBusinessInvite, setIsBusinessInvite] = useState(false);
  const [inviteBusiness, setInviteBusiness] = useState(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Get invite token and business from URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const businessId = params.get('business');

    if (token && businessId) {
      setInviteToken(token);
      fetchInviteDetails(token, businessId);
    }
  }, []);

  const fetchInviteDetails = async (token, businessId) => {
    try {
      const { data, error } = await supabase
        .from("businessteaminvites")
        .select(`
          *,
          Business:businessid (
            id,
            name
          )
        `)
        .eq("token", token)
        .eq("businessid", businessId)
        .single();

      if (error) throw error;

      setInviteBusiness(data.Business);
      // Pre-fill email from invite
      setFormData(prev => ({
        ...prev,
        email: data.email
      }));
    } catch (error) {
      console.error("Error fetching invite details:", error);
    }
  };

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

    try {
      setLoading(true);

      // Register user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (signUpError) throw signUpError;

      const user = signUpData.user;
      if (user) {
        // Update user profile
        const { error: updateError } = await supabase
          .from("Users")
          .upsert({
            id: user.id,
            first_name: formData.first_name,
            last_name: formData.last_name,
            phone_number: formData.phone_number,
            email: formData.email
          });

        if (updateError) throw updateError;

        // If there's an invite, accept it
        if (inviteToken) {
          await handleAcceptInvite(user.id);
        }

        // Show confirmation message instead of the form
        setShowConfirmation(true);
      }
    } catch (error) {
      console.error("Registration error:", error);
      setErrorMessages([error.message || "Unable to register. Please try again."]);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = async (userId) => {
    try {
      const { data: inviteData, error: inviteError } = await supabase
        .from("businessteaminvites")
        .select("*")
        .eq("token", inviteToken)
        .single();

      if (inviteError) throw inviteError;

      // Add user to BusinessTeam
      const { data: businessTeamData, error: teamError } = await supabase
        .from("BusinessTeam")
        .insert([{
          businessId: inviteBusiness.id,
          userId: userId,
          worktime: null,
          bufferTime: null
        }])
        .select()
        .single();

      if (teamError) throw teamError;

      // Add permissions if they exist in the invite
      if (inviteData.permissions && Array.isArray(inviteData.permissions) && inviteData.permissions.length > 0) {
        const permissionsToAdd = inviteData.permissions.map(permissionId => ({
          businessTeamId: businessTeamData.id,
          permissionId: permissionId
        }));

        const { error: permissionsError } = await supabase
          .from("BusinessTeam_Permissions")
          .insert(permissionsToAdd);

        if (permissionsError) throw permissionsError;
      }

      // Delete the invitation
      await supabase
        .from("businessteaminvites")
        .delete()
        .eq("token", inviteToken);

      // Navigate to verify email page
      navigate("/verify-email");
    } catch (error) {
      console.error("Error accepting invitation:", error);
      setErrorMessages([error.message || "Error accepting invitation"]);
    }
  };

  const handleDeclineInvite = async () => {
    try {
      // Delete the invitation
      await supabase
        .from("businessteaminvites")
        .delete()
        .eq("token", inviteToken);

      // Navigate to create business page
      navigate("/create-business");
    } catch (error) {
      console.error("Error declining invitation:", error);
      setErrorMessages([error.message || "Error declining invitation"]);
    }
  };

  return (
    <div className="flex h-screen justify-center items-center bg-primary">
      <div className="w-full max-w-md p-8 bg-white shadow-md rounded-lg">
        {showConfirmation ? (
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Потвърдете имейла си</h2>
            <p className="mb-4">Моля, проверете имейла си, за да потвърдите акаунта си.</p>
            <button
              onClick={() => navigate("/login")}
              className="w-full bg-accent text-white py-2 px-4 rounded-md hover:bg-accent/90 transition-colors"
            >
              Отидете на вход
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-center mb-6">
              {inviteToken ? "Приемете покана за екип" : "Създайте акаунт"}
            </h2>
            {errorMessages.length > 0 && (
              <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
                {errorMessages.map((msg, idx) => (
                  <p key={idx}>{msg}</p>
                ))}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" htmlFor="first_name">
                  Име
                </label>
                <input
                  id="first_name"
                  name="first_name"
                  type="text"
                  value={formData.first_name}
                  onChange={handleChange}
                  placeholder="Въведете вашето име"
                  className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" htmlFor="last_name">
                  Фамилия
                </label>
                <input
                  id="last_name"
                  name="last_name"
                  type="text"
                  value={formData.last_name}
                  onChange={handleChange}
                  placeholder="Въведете вашата фамилия"
                  className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                  required
                />
              </div>
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
                  className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" htmlFor="phone_number">
                  Телефонен номер
                </label>
                <input
                  id="phone_number"
                  name="phone_number"
                  type="tel"
                  value={formData.phone_number}
                  onChange={handleChange}
                  placeholder="Въведете вашия телефонен номер"
                  className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                  required
                />
              </div>
              <div className="mb-6 relative">
                <label className="block text-sm font-medium mb-2" htmlFor="password">
                  Парола
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Въведете вашата парола"
                    className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <FaEyeSlash size={20} /> : <FaEye size={20} />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                className={`w-full bg-accent text-white py-2 px-4 rounded-md hover:bg-accent/90 transition-colors ${
                  loading ? "opacity-50 cursor-not-allowed" : ""
                }`}
                disabled={loading}
              >
                {loading ? "Регистрация..." : "Регистрирай се"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default Register;