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
      // Check if the id corresponds to a non-business route
      if (id === "dashboard") { // Exclude the dashboard or any other non-business routes
        navigate('/dashboard'); // Redirect to the dashboard
        return;
      }

      try {
        const { data, error } = await supabase
          .from("Business")
          .select(`
            theme, 
            themeData, 
            visibility,
            name,
            description,
            logo_url
          `) 
          .eq("id", id)
          .single();

        if (error) {
          // Handle case when business is not found or other errors
          if (error.code === 'PGRST116') { // Supabase code for no rows returned
            navigate(id + '/404');
            return;
          }
          throw error;
        }

        if (data.visibility === false) {
          navigate(id + "/404");
          return;
        }

        // Prepare SEO data
        const seoData = {
          title: data.name || 'Business Page',
          description: data.description || 'Welcome to our business page',
          ogImage: data.logo_url || '',
          keywords: `${data.name}, business, services`,
          url: window.location.href,
        };

        setTheme(data.theme || "default");
        setThemeData({
          ...data.themeData,
          seo: seoData
        });
        setLoading(false);
      } catch (err) {
        console.error(err);
        navigate(id + '/404');
      }
    };

    fetchBusinessData();
  }, [id, navigate]);

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
