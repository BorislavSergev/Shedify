import React, { useState } from "react";
import supabase from "../hooks/supabase";
import { useNavigate } from "react-router-dom";
import defaultThemeData from "./themes/default/data.json";

const CreateBusiness = () => {
  const [formData, setFormData] = useState({
    name: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError("Please enter a business name");
      return;
    }

    try {
      setLoading(true);
      setError("");

      // Get the logged-in user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) throw new Error("Authentication failed. Please log in again.");
      if (!user || !user.id) throw new Error("No authenticated user found. Please log in.");

      // First, check if the Default theme exists
      const { data: themeData, error: themeError } = await supabase
        .from("Themes")
        .select("name")
        .eq("name", "Default")
        .single();

      if (themeError || !themeData) {
        console.error('Theme Error:', themeError);
        // Create the Default theme if it doesn't exist
        const { error: createThemeError } = await supabase
          .from("Themes")
          .insert([{ name: "Default", description: "Default theme" }]);
        
        if (createThemeError) throw new Error("Failed to create default theme");
      }

      // Log the data we're about to insert
      console.log('Attempting to create business with:', {
        name: formData.name.trim(),
        owner_id: user.id,
        type: "Other",
        visibility: false,
        theme: "Default",
        themeData: defaultThemeData,
        language: "bg"
      });

      // Create the business
      const { data: businessData, error: businessError } = await supabase
        .from("Business")
        .insert({
          name: formData.name.trim(),
          owner_id: user.id,
          type: "Other",
          visibility: false,
          theme: "Default",
          themeData: defaultThemeData, // Using the raw object, Supabase will handle JSON conversion
          language: "bg"
        })
        .select('*') // Select all fields to verify what was saved
        .single();
      
      if (businessError) {
        console.error('Business Creation Error:', businessError);
        throw new Error(businessError.message);
      }

      // Log the created business data
      console.log('Created business:', businessData);

      if (!businessData || !businessData.id) {
        throw new Error("Failed to create business");
      }

      // Add user to BusinessTeam
      const { error: businessTeamError } = await supabase
        .from("BusinessTeam")
        .insert([{
          business_id: businessData.id,
          user_id: user.id,
        }])
        .select();

      if (businessTeamError) {
        console.error('BusinessTeam Error:', businessTeamError);
        throw new Error(businessTeamError.message);
      }

      navigate("/dashboard");
    } catch (error) {
      console.error('Error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Create New Business</h1>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            name="name"
            placeholder="Business Name"
            value={formData.name}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-md"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2 rounded-md ${
              loading 
                ? "bg-gray-400 cursor-not-allowed" 
                : "bg-accent hover:bg-accentHover"
            } text-white`}
          >
            {loading ? "Creating..." : "Create Business"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateBusiness; 