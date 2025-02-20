import React, { useState } from "react";
import supabase from "../hooks/supabase";
import { useNavigate } from "react-router-dom";

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
      if (userError || !user) throw new Error("User authentication failed");

      const defaultThemeData = {
        general: {
          color: "#4CAF50",
          actionButtonText: "Book Appointment Now"
        },
        seo: {
          title: "Green Scissors | Professional Hair Salon",
          description: "Experience exceptional haircare at Green Scissors. Our expert stylists deliver cutting-edge styles and personalized service in a modern, eco-friendly environment.",
          keywords: "hair salon, professional haircuts, eco-friendly salon, green scissors, sustainable beauty",
          ogImage: "https://images.unsplash.com/photo-1560066984-138dadb4c035"
        },
        hero: {
          backgroundImageUrl: "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f",
          title: "Welcome to Green Scissors",
          subtitle: "Where Style Meets Sustainability"
        },
        about: {
          title: "About Our Salon",
          subtitle: "At Green Scissors, we believe in combining exceptional haircare with environmental responsibility. Our team of expert stylists is dedicated to creating beautiful, personalized looks while using eco-friendly products and sustainable practices.",
          imageUrl: "https://images.unsplash.com/photo-1562322140-8baeececf3df"
        },
        creations: {
          title: "Our Latest Creations",
          subtitle: "Explore our portfolio of stunning transformations and artistic excellence",
          images: [
            "https://images.unsplash.com/photo-1605497788044-5a32c7078486",
            "https://images.unsplash.com/photo-1492106087820-71f1a00d2b11",
            "https://images.unsplash.com/photo-1582095133179-bfd08e2fc6b3"
          ]
        },
        uniqueStyle: {
          title: "Discover Your Unique Style",
          subtitle: "We specialize in creating personalized looks that enhance your natural beauty while staying true to your individual style. Our experienced team works with you to achieve the perfect look that fits your lifestyle.",
          imageUrl: "https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1"
        },
        footer: {
          copyright: `© ${new Date().getFullYear()} ${formData.name}. All rights reserved.`
        }
      };

      // Create the business using service role to bypass RLS
      const { data: businessData, error: businessError } = await supabase
        .from("Business")
        .insert([{
          name: formData.name,
          owner_id: user.id,
          visibility: false,
          theme: "default",
          language: "bg"
        }])
        .select('id, name, owner_id, visibility, theme, language')
        .single();
      
      if (businessError) {
        console.error('Business Creation Error:', businessError);
        throw new Error(businessError.message);
      }

      // Add user to BusinessTeam
      const { data: businessTeamData, error: businessTeamError } = await supabase
        .from("BusinessTeam")
        .insert([{
          businessId: businessData.id,
          userId: user.id,
        }])
        .select();

      if (businessTeamError) throw new Error(businessTeamError.message);

      // Add all permissions for the owner
      const permissionIds = [12, 13, 14, 15, 16]; // All settings permissions
      const permissionsToInsert = permissionIds.map(permissionId => ({
        businessTeamId: businessTeamData[0].id,
        permissionId,
      }));

      const { error: permissionsError } = await supabase
        .from("BusinessTeam_Permissions")
        .insert(permissionsToInsert);

      if (permissionsError) throw new Error(permissionsError.message);

      navigate("/dashboard");
    } catch (error) {
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