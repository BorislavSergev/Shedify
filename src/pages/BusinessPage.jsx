import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom"; // For getting the business ID and navigate
import supabase from "../hooks/supabase"; // Import your Supabase client
import ModernTheme from "./themes/modern/modern";
import Default from "./themes/default/default";
import PageCustomizer from "../components/PageCustomizer"; // Import the customizer for editing

const BusinessPage = () => {
  const { id } = useParams(); // Get the business id from the URL
  const navigate = useNavigate(); // To navigate programmatically
  const [theme, setTheme] = useState("default");
  const [themeData, setThemeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBusinessData = async () => {
      try {
        const { data, error } = await supabase
          .from("Business")
          .select("theme, themeData, visibility") 
          .eq("id", id)
          .single();
        if (error) throw error;

        console.log(data);
        if (data.visibility === false) {
          // Redirect to /404 if visibility is false
          navigate('/business/' + id + "/404");
          return;
        }

        setTheme(data.theme || "default"); // Set the theme (e.g., modern, default)
        setThemeData(data.themeData || {}); // Load the themeData JSON
        setLoading(false);
      } catch (err) {
        setError("Failed to load business data.");
        setLoading(false);
      }
    };

    fetchBusinessData();
  }, [id, navigate]); // Don't forget to include navigate as a dependency

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div>
      {theme.toLowerCase() === "modern" && <ModernTheme previewData={themeData} />}
      {theme.toLowerCase() === "default" && <Default previewData={themeData} />}
    </div>
  );
};

export default BusinessPage;
