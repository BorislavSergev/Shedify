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

      // First, ensure the Default theme exists
      const { data: themeData, error: themeError } = await supabase
        .from("Themes")
        .select("*")
        .eq("name", "Default")
        .single();

      console.log("Theme check result:", themeData, themeError);

      if (themeError || !themeData) {
        // Create the Default theme if it doesn't exist
        const { data: newTheme, error: createThemeError } = await supabase
          .from("Themes")
          .insert([{
            name: "Default",
            description: "Default theme"
          }])
          .select()
          .single();

        if (createThemeError) {
          console.error('Theme Creation Error:', createThemeError);
          throw new Error("Failed to create default theme");
        }
        console.log("Created new theme:", newTheme);
      }

      // Prepare the business data
      const businessData = {
        name: formData.name.trim(),
        owner_id: user.id,
        type: "Other",
        visibility: false,
        theme: "Default",
        "themeData": defaultThemeData, // Using quotes to ensure exact column name match
        language: "bulgarian",
        free_trial: false
      };

      console.log("Attempting to create business with data:", businessData);

      // Create the business
      const { data: createdBusiness, error: businessError } = await supabase
        .from("Business")
        .insert([businessData])
        .select(`
          id,
          name,
          owner_id,
          type,
          visibility,
          theme,
          "themeData",
          language,
          free_trial
        `)
        .single();

      if (businessError) {
        console.error('Business Creation Error:', businessError);
        throw new Error(businessError.message);
      }

      console.log("Created business:", createdBusiness);

      // Set the selected business in local storage
      const firstBusiness = { id: createdBusiness.id, name: createdBusiness.name };
      localStorage.setItem("selectedBusiness", JSON.stringify(firstBusiness));

      if (!createdBusiness.theme || !createdBusiness.themeData) {
        console.error('Theme or themeData is null in created business');
      }

      // Add user to BusinessTeam
      const { data: businessTeam, error: businessTeamError } = await supabase
        .from("BusinessTeam")
        .insert([{
          businessId: createdBusiness.id,
          userId: user.id,
        }])
        .select()
        .single();

      if (businessTeamError) {
        console.error('BusinessTeam Error:', businessTeamError);
        throw new Error(businessTeamError.message);
      }

      // Fetch all permissions
      const { data: permissions, error: permissionsError } = await supabase
        .from("Permissions")
        .select("id");

      if (permissionsError) {
        console.error('Permissions Error:', permissionsError);
        throw new Error(permissionsError.message);
      }

      // Create BusinessTeam_Permissions entries
      const permissionEntries = permissions.map(permission => ({
        businessTeamId: businessTeam.id,
        permissionId: permission.id
      }));

      const { error: teamPermissionsError } = await supabase
        .from("BusinessTeam_Permissions")
        .insert(permissionEntries);

      if (teamPermissionsError) {
        console.error('BusinessTeam_Permissions Error:', teamPermissionsError);
        throw new Error(teamPermissionsError.message);
      }

      // Navigate to dashboard after a delay
      setTimeout(() => {
        navigate("/dashboard");
      }, 1000); // Delay of 1 second

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
        <h1 className="text-2xl font-bold mb-6 text-center">Създай нов бизнес</h1>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            name="name"
            placeholder="Име на бизнеса"
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
            {loading ? "Създаване..." : "Създай бизнес"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateBusiness; 