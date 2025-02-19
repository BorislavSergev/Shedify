import React, { useState, useEffect, useMemo } from "react";
import { AiOutlineClose, AiOutlineSave, AiOutlineWarning } from "react-icons/ai";
import { motion, AnimatePresence } from "framer-motion";
import { HexColorPicker } from "react-colorful";
import Modern from "../pages/themes/modern/modern";
import Default from "../pages/themes/default/default";
import supabase from "../hooks/supabase";
import { useNavigate } from "react-router-dom";
import { useLanguage } from '../contexts/LanguageContext';

// Add these helper functions at the top of the file, before the component definition
const isLightColor = (color) => {
  if (!color) return true;
  // Convert hex to RGB
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5;
};

// Add this helper component for drag and drop functionality
const DraggableImage = ({ src, index, onRemove, onDragStart, onDragEnd, onDragOver }) => {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      className="relative group"
    >
      <img
        src={src}
        alt={`Creation ${index + 1}`}
        className="rounded-lg object-cover h-32 w-full"
      />
      <button
        onClick={() => onRemove(index)}
        className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <AiOutlineClose />
      </button>
    </div>
  );
};

const PageCustomizer = ({ onClose }) => {
  const { translate } = useLanguage();
  const [activeTab, setActiveTab] = useState("General");
  const [customData, setCustomData] = useState({});
  const [isChanged, setIsChanged] = useState(false);
  const [theme, setTheme] = useState("default");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const navigate = useNavigate();

  // Fetch selected business from localStorage
  const selectedBusiness = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("selectedBusiness")) || {};
    } catch (error) {
      console.error("Invalid business data in local storage", error);
      return {};
    }
  }, []);

  const businessId = selectedBusiness.id;

  // Fetch theme data from Supabase
  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase
        .from("Business")
        .select("themeData, theme")
        .eq("id", businessId)
        .single();

      if (error) {
        console.error("Error fetching theme data:", error);
      } else if (data) {
        setCustomData(data.themeData || {});
        setTheme(data.theme.toLowerCase());
      }
    };

    if (businessId) fetchData();
  }, [businessId]);

  // Warn about unsaved changes before closing the tab/window
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isChanged) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () =>
      window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isChanged]);

  // Update customData when inputs change
  const handleInputChange = (section, field, value) => {
    setCustomData((prevData) => ({
      ...prevData,
      [section]: {
        ...prevData[section],
        [field]: value,
      },
    }));
    setIsChanged(true);
  };

  // Add this function to handle color changes
  const handleColorChange = (color) => {
    handleInputChange('general', 'color', color);
  };

  // Handle single file uploads for images/videos
  const handleFileUpload = async (e, section, field) => {
    const file = e.target.files[0];
    if (!file) return;

    const isVideo = field.includes("video");
    const allowedTypes = isVideo
      ? ["video/mp4", "video/webm"]
      : ["image/jpeg", "image/png"];
    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;

    if (!allowedTypes.includes(file.type)) {
      alert(`Invalid file type. Allowed: ${allowedTypes.join(", ")}`);
      return;
    }

    if (file.size > maxSize) {
      alert(`File too large. Max size: ${maxSize / 1024 / 1024}MB`);
      return;
    }

    try {
      const fileName = `${section}_${field}_${Date.now()}.${file.name.split(".").pop()}`;
      const filePath = `business_${businessId}/${section}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("Business")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("Business")
        .getPublicUrl(filePath);

      handleInputChange(section, field, publicUrl);
    } catch (error) {
      console.error("Upload error:", error);
      alert("Upload failed: " + error.message);
    }
  };

  // Handle multiple file uploads (for sections like Creations)
  const handleMultipleFileUpload = async (e, section, field) => {
    const files = Array.from(e.target.files);
    const allowedTypes = ["image/jpeg", "image/png"];
    const maxSize = 10 * 1024 * 1024;
    let uploadedUrls = customData[section]?.[field] || [];
    if (!Array.isArray(uploadedUrls)) {
      uploadedUrls = [];
    }
    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        alert("Invalid file type. Allowed: jpeg, png");
        continue;
      }
      if (file.size > maxSize) {
        alert("File size exceeds limit");
        continue;
      }
      try {
        const fileExt = file.name.split(".").pop();
        const fileName = `${section}_${field}_${Date.now()}_${file.name}`;
        const filePath = `business_${businessId}/${section}/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from("Business")
          .upload(filePath, file);
        if (uploadError?.statusCode === 409) {
          await supabase.storage.from("Business").remove([filePath]);
          await supabase.storage.from("Business").upload(filePath, file);
        } else if (uploadError) {
          throw uploadError;
        }
        const {
          data: { publicUrl },
        } = supabase.storage.from("Business").getPublicUrl(filePath);
        uploadedUrls.push(publicUrl);
      } catch (error) {
        console.error("Upload error:", error);
        alert("Upload failed for one file: " + error.message);
      }
    }
    setCustomData((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: uploadedUrls },
    }));
    setIsChanged(true);
  };

  // Helpers for array-based fields (for Services and Testimonials)
  const handleArrayItemChange = (section, field, index, key, value) => {
    setCustomData((prev) => {
      const arr = prev[section]?.[field]
        ? [...prev[section][field]]
        : [];
      if (arr[index]) {
        arr[index] = { ...arr[index], [key]: value };
      }
      return { ...prev, [section]: { ...prev[section], [field]: arr } };
    });
    setIsChanged(true);
  };

  const handleAddArrayItem = (section, field, newItem) => {
    setCustomData((prev) => {
      const arr = prev[section]?.[field]
        ? [...prev[section][field]]
        : [];
      arr.push(newItem);
      return { ...prev, [section]: { ...prev[section], [field]: arr } };
    });
    setIsChanged(true);
  };

  const handleRemoveArrayItem = (section, field, index) => {
    setCustomData((prev) => {
      const arr = prev[section]?.[field]
        ? [...prev[section][field]]
        : [];
      arr.splice(index, 1);
      return { ...prev, [section]: { ...prev[section], [field]: arr } };
    });
    setIsChanged(true);
  };

  // Add these new handlers for image management
  const handleRemoveImage = (section, field, index) => {
    setCustomData(prev => {
      const newImages = [...(prev[section]?.[field] || [])];
      newImages.splice(index, 1);
      return {
        ...prev,
        [section]: {
          ...prev[section],
          [field]: newImages
        }
      };
    });
    setIsChanged(true);
  };

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    setCustomData(prev => {
      const newImages = [...(prev.creations?.images || [])];
      const draggedImage = newImages[draggedIndex];
      newImages.splice(draggedIndex, 1);
      newImages.splice(index, 0, draggedImage);
      return {
        ...prev,
        creations: {
          ...prev.creations,
          images: newImages
        }
      };
    });
    setDraggedIndex(index);
    setIsChanged(true);
  };

  // Save changes to Supabase
  const handleSave = async () => {
    if (!businessId) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("Business")
        .update({ themeData: customData })
        .eq("id", businessId);

      if (error) throw error;

      setIsChanged(false);
      alert("Changes saved successfully!");
      onClose?.();
      navigate("/dashboard");
    } catch (error) {
      console.error("Save error:", error);
      alert("Failed to save changes: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle close with unsaved changes confirmation
  const handleClose = () => {
    if (isChanged) {
      setShowUnsavedModal(true);
    } else {
      onClose?.();
      navigate("/dashboard");
    }
  };

  // Render the appropriate tabs based on the selected theme
  const renderTabs = () => {
    const tabs =
      theme === "modern"
        ? [
            "general",
            "seo",
            "hero",
            "aboutUs",
            "creations",
            "uniqueStyle",
            "footer",
          ]
        : [
            "general",
            "seo",
            "hero",
            "aboutUs",
            "creations",
            "uniqueStyle",
            "footer",
          ];

    return (
      <div className="flex overflow-x-auto md:overflow-visible md:flex-col gap-2 pb-2 md:pb-0">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(translate(tab))}
            className={`min-w-max px-4 py-2 rounded-md text-sm md:text-base ${
              activeTab === translate(tab)
                ? "bg-accent text-white"
                : "bg-gray-200 hover:bg-gray-300"
            }`}
          >
            {translate(tab)}
          </button>
        ))}
      </div>
    );
  };

  // Render section form based on the active tab
  const renderSection = () => {
    const commonInputClass =
      "w-full p-2 border rounded focus:ring-2 focus:ring-blue-500";

    switch (activeTab) {
      case "General":
        return (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <div className="relative">
              <label className="block mb-2 font-medium">Theme Color</label>
              <div 
                className="h-10 rounded-lg cursor-pointer flex items-center px-3"
                style={{ 
                  backgroundColor: customData.general?.color || '#4CAF50',
                  color: isLightColor(customData.general?.color) ? '#000' : '#fff'
                }}
                onClick={() => setShowColorPicker(!showColorPicker)}
              >
                <span>{customData.general?.color || '#4CAF50'}</span>
              </div>
              {showColorPicker && (
                <div className="absolute z-50 mt-2">
                  <div 
                    className="fixed inset-0" 
                    onClick={() => setShowColorPicker(false)} 
                  />
                  <div className="relative">
                    <HexColorPicker
                      color={customData.general?.color || '#4CAF50'}
                      onChange={handleColorChange}
                    />
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="block mb-2 font-medium">Button Text</label>
              <input
                type="text"
                className={commonInputClass}
                value={customData.general?.actionButtonText || ''}
                onChange={(e) => handleInputChange('general', 'actionButtonText', e.target.value)}
                placeholder="e.g., Book Now"
              />
            </div>
          </motion.div>
        );

      case "SEO":
        return (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <div>
              <label className="block mb-2 font-medium">Page Title</label>
              <input
                type="text"
                className={commonInputClass}
                value={customData.seo?.title || ''}
                onChange={(e) => handleInputChange('seo', 'title', e.target.value)}
                placeholder="Page Title"
              />
            </div>
            <div>
              <label className="block mb-2 font-medium">Meta Description</label>
              <textarea
                className={commonInputClass}
                value={customData.seo?.description || ''}
                onChange={(e) => handleInputChange('seo', 'description', e.target.value)}
                placeholder="Meta Description"
                rows={3}
              />
            </div>
            <div>
              <label className="block mb-2 font-medium">Keywords</label>
              <input
                type="text"
                className={commonInputClass}
                value={customData.seo?.keywords || ''}
                onChange={(e) => handleInputChange('seo', 'keywords', e.target.value)}
                placeholder="Keywords (comma-separated)"
              />
            </div>
            <div>
              <label className="block mb-2 font-medium">OG Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, "seo", "ogImage")}
                className="text-sm mb-2"
              />
              {customData.seo?.ogImage && (
                <div className="mt-2 relative group">
                  <img
                    src={customData.seo.ogImage}
                    alt="OG Preview"
                    className="rounded-lg object-cover h-32 w-full"
                  />
                  <button
                    onClick={() => handleInputChange('seo', 'ogImage', '')}
                    className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <AiOutlineClose />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        );

      case "Hero":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Hero Section</h3>
            <div>
              <label className="block mb-2">Title</label>
              <input
                type="text"
                className={commonInputClass}
                value={customData.hero?.title || ""}
                onChange={(e) =>
                  handleInputChange("hero", "title", e.target.value)
                }
              />
            </div>
            <div>
              <label className="block mb-2">Subtitle</label>
              <input
                type="text"
                className={commonInputClass}
                value={customData.hero?.subtitle || ""}
                onChange={(e) =>
                  handleInputChange("hero", "subtitle", e.target.value)
                }
              />
            </div>
            {theme === "modern" ? (
              <>
                <div>
                  <label className="block mb-2">
                    Video
                  </label>
                  <input
                    type="file"
                    accept="video/mp4,video/webm"
                    onChange={(e) =>
                      handleFileUpload(e, "hero", "videoUrl")
                    }
                    className="text-sm"
                  />
                  {customData.hero?.videoUrl && (
                    <div className="mt-2 aspect-video bg-gray-100 rounded overflow-hidden">
                      <video controls className="w-full">
                        <source
                          src={customData.hero.videoUrl}
                          type="video/mp4"
                        />
                      </video>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block mb-2">
                  Thumbnail
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      handleFileUpload(e, "hero", "imageUrl")
                    }
                    className="text-sm"
                  />
                  {customData.hero?.imageUrl && (
                    <img
                      src={customData.hero.imageUrl}
                      alt="Fallback"
                      className="mt-2 rounded object-cover h-32 w-full"
                    />
                  )}
                </div>
              </>
            ) : (
              <div>
                <label className="block mb-2">
                  Background Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    handleFileUpload(e, "hero", "backgroundImageUrl")
                  }
                  className="text-sm"
                />
                {customData.hero?.backgroundImageUrl && (
                  <img
                    src={customData.hero.backgroundImageUrl}
                    alt="Background"
                    className="mt-2 rounded object-cover h-32 w-full"
                  />
                )}
              </div>
            )}
          </div>
        );

      case "About Us":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">About Us Section</h3>
            <div>
              <label className="block mb-2">Title</label>
              <input
                type="text"
                className={commonInputClass}
                value={customData.about?.title || ""}
                onChange={(e) =>
                  handleInputChange("about", "title", e.target.value)
                }
              />
            </div>
            <div>
              <label className="block mb-2">Subtitle</label>
              <input
                type="text"
                className={commonInputClass}
                value={customData.about?.subtitle || ""}
                onChange={(e) =>
                  handleInputChange("about", "subtitle", e.target.value)
                }
              />
            </div>
            <div>
              <label className="block mb-2">Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  handleFileUpload(e, "about", "imageUrl")
                }
                className="text-sm"
              />
              {customData.about?.imageUrl && (
                <img
                  src={customData.about.imageUrl}
                  alt="About Us"
                  className="mt-2 rounded object-cover h-32 w-full"
                />
              )}
            </div>
          </div>
        );

      case "Unique Style":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Unique Style Section</h3>
            <div>
              <label className="block mb-2">Title</label>
              <input
                type="text"
                className={commonInputClass}
                value={customData.uniqueStyle?.title || ""}
                onChange={(e) =>
                  handleInputChange("uniqueStyle", "title", e.target.value)
                }
              />
            </div>
            <div>
              <label className="block mb-2">Subtitle</label>
              <input
                type="text"
                className={commonInputClass}
                value={customData.uniqueStyle?.subtitle || ""}
                onChange={(e) =>
                  handleInputChange("uniqueStyle", "subtitle", e.target.value)
                }
              />
            </div>
            <div>
              <label className="block mb-2">Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  handleFileUpload(e, "uniqueStyle", "imageUrl")
                }
                className="text-sm"
              />
              {customData.uniqueStyle?.imageUrl && (
                <img
                  src={customData.uniqueStyle.imageUrl}
                  alt="Unique Style"
                  className="mt-2 rounded object-cover h-32 w-full"
                />
              )}
            </div>
          </div>
        );

      case "Creations":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Creations Section</h3>
            <div>
              <label className="block mb-2">Title</label>
              <input
                type="text"
                className={commonInputClass}
                value={customData.creations?.title || ""}
                onChange={(e) =>
                  handleInputChange("creations", "title", e.target.value)
                }
              />
            </div>
            <div>
              <label className="block mb-2">Subtitle</label>
              <input
                type="text"
                className={commonInputClass}
                value={customData.creations?.subtitle || ""}
                onChange={(e) =>
                  handleInputChange("creations", "subtitle", e.target.value)
                }
              />
            </div>
            <div>
              <label className="block mb-2">Images</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) =>
                  handleMultipleFileUpload(e, "creations", "images")
                }
                className="text-sm mb-4"
              />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {customData.creations?.images?.map((img, idx) => (
                  <DraggableImage
                    key={idx}
                    src={img}
                    index={idx}
                    onRemove={(index) => handleRemoveImage("creations", "images", index)}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, idx)}
                  />
                ))}
              </div>
            </div>
          </div>
        );

      case "Services":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Services Section</h3>
            {customData.services && customData.services.length > 0 ? (
              customData.services.map((service, index) => (
                <div
                  key={index}
                  className="border p-2 rounded mb-2 space-y-2"
                >
                  <div>
                    <label className="block mb-1">Title</label>
                    <input
                      type="text"
                      className={commonInputClass}
                      value={service.title || ""}
                      onChange={(e) =>
                        handleArrayItemChange(
                          "services",
                          "services",
                          index,
                          "title",
                          e.target.value
                        )
                      }
                    />
                  </div>
                  <div>
                    <label className="block mb-1">Description</label>
                    <input
                      type="text"
                      className={commonInputClass}
                      value={service.description || ""}
                      onChange={(e) =>
                        handleArrayItemChange(
                          "services",
                          "services",
                          index,
                          "description",
                          e.target.value
                        )
                      }
                    />
                  </div>
                  <button
                    onClick={() =>
                      handleRemoveArrayItem("services", "services", index)
                    }
                    className="text-red-500 text-sm"
                  >
                    Remove Service
                  </button>
                </div>
              ))
            ) : (
              <p>No services added.</p>
            )}
            <button
              onClick={() =>
                handleAddArrayItem("services", "services", {
                  title: "",
                  description: "",
                })
              }
              className="py-2 px-4 bg-green-500 text-white rounded"
            >
              Add Service
            </button>
          </div>
        );

      case "Testimonials":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Testimonials Section</h3>
            {customData.testimonials &&
            customData.testimonials.length > 0 ? (
              customData.testimonials.map((testimonial, index) => (
                <div
                  key={index}
                  className="border p-2 rounded mb-2 space-y-2"
                >
                  <div>
                    <label className="block mb-1">Name</label>
                    <input
                      type="text"
                      className={commonInputClass}
                      value={testimonial.name || ""}
                      onChange={(e) =>
                        handleArrayItemChange(
                          "testimonials",
                          "testimonials",
                          index,
                          "name",
                          e.target.value
                        )
                      }
                    />
                  </div>  
                  <div>
                    <label className="block mb-1">Feedback</label>
                    <input
                      type="text"
                      className={commonInputClass}
                      value={testimonial.feedback || ""}
                      onChange={(e) =>
                        handleArrayItemChange(
                          "testimonials",
                          "testimonials",
                          index,
                          "feedback",
                          e.target.value
                        )
                      }
                    />
                  </div>
                  <div>
                    <label className="block mb-1">Image</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        handleFileUpload(e, "testimonials", `imageUrl_${index}`)
                      }
                      className="text-sm"
                    />
                    {testimonial.imageUrl && (
                      <img
                        src={testimonial.imageUrl}
                        alt={`Testimonial ${index}`}
                        className="object-cover h-20 w-full rounded mt-1"
                      />
                    )}
                  </div>
                  <button
                    onClick={() =>
                      handleRemoveArrayItem(
                        "testimonials",
                        "testimonials",
                        index
                      )
                    }
                    className="text-red-500 text-sm"
                  >
                    Remove Testimonial
                  </button>
                </div>
              ))
            ) : (
              <p>No testimonials added.</p>
            )}
            <button
              onClick={() =>
                handleAddArrayItem("testimonials", "testimonials", {
                  name: "",
                  feedback: "",
                })
              }
              className="py-2 px-4 bg-green-500 text-white rounded"
            >
              Add Testimonial
            </button>
          </div>
        );

      case "Footer":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Footer Section</h3>
            <div>
              <label className="block mb-2">Copyright</label>
              <input
                type="text"
                className={commonInputClass}
                value={customData.footer?.copyright || ""}
                onChange={(e) =>
                  handleInputChange("footer", "copyright", e.target.value)
                }
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <div className="w-full md:w-96 h-auto md:h-full overflow-y-auto bg-gray-50 p-4 border-r">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">{translate("pageCustomizer")}</h2>
          <button
            onClick={() => isChanged ? setShowUnsavedModal(true) : onClose()}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <AiOutlineClose className="text-xl" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-4 md:pb-0">
          {renderTabs()}
        </div>

        {/* Section Content */}
        <div className="mt-6">
          {renderSection()}
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={!isChanged || isSaving}
          className={`w-full mt-6 py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors ${
            isChanged && !isSaving
              ? 'bg-accent hover:bg-accent-dark text-white'
              : 'bg-gray-300 cursor-not-allowed text-gray-500'
          }`}
        >
          <AiOutlineSave />
          <span>{isSaving ? translate("saving") : translate("saveChanges")}</span>
        </button>
      </div>

      {/* Preview Area */}
      <div className="flex-1 overflow-auto bg-gray-100">
        <div className="max-w-6xl mx-auto">
          {theme === 'modern' ? (
            <Modern previewData={customData} />
          ) : (
            <Default previewData={customData} />
          )}
        </div>
      </div>

      {/* Unsaved Changes Modal */}
      <AnimatePresence>
        {showUnsavedModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-xl p-6 max-w-md w-full"
            >
              <div className="flex items-center gap-3 text-amber-500 mb-4">
                <AiOutlineWarning className="text-2xl" />
                <h3 className="text-xl font-bold">Unsaved Changes</h3>
              </div>
              <p className="text-gray-600 mb-6">
                You have unsaved changes. What would you like to do?
              </p>
              <div className="space-y-3">
                <button
                  onClick={async () => {
                    await handleSave();
                    onClose();
                  }}
                  className="w-full py-2 px-4 bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => {
                    setIsChanged(false);
                    onClose();
                  }}
                  className="w-full py-2 px-4 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Discard Changes
                </button>
                <button
                  onClick={() => setShowUnsavedModal(false)}
                  className="w-full py-2 px-4 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PageCustomizer;
