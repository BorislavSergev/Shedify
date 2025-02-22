import React, { useState, useEffect, useMemo } from "react";
import supabase from "../hooks/supabase"; // Import Supabase client
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

const Settings = () => {
  const { translate } = useLanguage();
  const [activeTab, setActiveTab] = useState("general");
  const [businessDetails, setBusinessDetails] = useState({ name: "", language: "english", planId: 0 });
  const [workTime, setWorkTime] = useState({});
  const [bufferTime, setBufferTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTheme, setActiveTheme] = useState("");
  const [themes, setThemes] = useState([]);
  const [userPermissions, setUserPermissions] = useState([]);

  const navigate = useNavigate();

  const selectedBusiness = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("selectedBusiness")) || {};
    } catch {
      console.error("Invalid business data in localStorage");
      return {};
    }
  }, []);

  useEffect(() => {
    console.log("Selected Business ID:", selectedBusiness?.id);
    if (selectedBusiness?.id) {
      fetchUserPermissions().then((hasViewAccess) => {
        console.log("Has View Access:", hasViewAccess);
        if (hasViewAccess) {
          fetchBusinessDetails();
          fetchWorkTime();
          fetchThemes();
          fetchBufferTime();
        }
        
        if (!hasPermission('settings_general')) {
          setActiveTab("worktime");
        }
      });
    }
  }, [selectedBusiness?.id]);

  const fetchUserPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data: businessTeamData, error: businessTeamError } = await supabase
        .from("BusinessTeam")
        .select("id")
        .eq("userId", user.id)
        .eq("businessId", selectedBusiness.id)
        .single();

      if (businessTeamError) throw businessTeamError;

      const { data: permissionsData, error: permissionsError } = await supabase
        .from("BusinessTeam_Permissions")
        .select(`
          permissionId,
          Permissions (
            id,
            permission
          )
        `)
        .eq("businessTeamId", businessTeamData.id);

      if (permissionsError) throw permissionsError;

      const permissions = permissionsData.map(p => p.permissionId);
      setUserPermissions(permissions);

      const hasViewAccess = permissionsData.some(p =>
        p.Permissions.permission === 'view_settings'
      );

      return hasViewAccess;
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      return false;
    }
  };

  const fetchBusinessDetails = async () => {
    console.log("Fetching business details for ID:", selectedBusiness.id);
    if (!selectedBusiness.id) return;
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("Business")
        .select("name, language, theme, planId")
        .eq("id", selectedBusiness.id)
        .single();

      console.log("Raw Supabase Response:", data);

      if (error) {
        console.error("Supabase Error:", error);
        throw error;
      }

      if (!data.planId) {
        console.log("No plan ID found, navigating to subscription");
        navigate('/subscription');
        return;
      }

      setActiveTheme(data.theme);

      console.log("Setting business details with:", {
        name: data.name || "",
        language: data.language || "english",
        planId: data.planId
      });

      setBusinessDetails({
        name: data.name || "",
        language: data.language || "english",
        planId: data.planId,
      });

      console.log("Business Name:", data.name);
      console.log("Business Language:", data.language);

    } catch (error) {
      console.error("Error fetching business details:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWorkTime = async () => {
    if (!selectedBusiness.id) return;
    const { data: { user } } = await supabase.auth.getUser();
    try {
      const { data, error } = await supabase
        .from("BusinessTeam")
        .select("worktime")
        .eq("businessId", selectedBusiness.id)
        .eq("userId", user.id)
        .single();
      if (error) throw error;
      setWorkTime(data?.worktime || {});
    } catch (error) {
      console.error("Error fetching work time:", error.message);
    }
  };

  const fetchThemes = async () => {
    try {
      const { data, error } = await supabase.from("Themes").select();
      if (error) throw error;
      setThemes(data);
    } catch (error) {
      console.error("Error fetching themes:", error.message);
    }
  };

  const fetchBufferTime = async () => {
    if (!selectedBusiness.id) return;
    const { data: { user } } = await supabase.auth.getUser();
    try {
      const { data, error } = await supabase
        .from("BusinessTeam")
        .select("bufferTime")
        .eq("businessId", selectedBusiness.id)
        .eq("userId", user.id)
        .single();
      if (error) throw error;
      setBufferTime(data?.bufferTime || 0);
    } catch (error) {
      console.error("Error fetching buffer time:", error.message);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setBusinessDetails((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveChanges = async () => {
    if (!businessDetails.name.trim()) {
      alert("Name cannot be empty.");
      return;
    }
    try {
      setIsSaving(true);
      const { error } = await supabase
        .from("Business")
        .update({
          name: businessDetails.name,
          language: businessDetails.language,
        })
        .eq("id", selectedBusiness.id);
      if (error) throw error;
      alert("Changes saved successfully!");
    } catch (error) {
      console.error("Error saving changes:", error.message);
      alert("Failed to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleThemeActivation = async (themeName) => {
    setActiveTheme(themeName);
    const { error } = await supabase
      .from('Business')
      .update({ theme: themeName })
      .eq('id', selectedBusiness.id);
    if (error) console.error("Error activating theme:", error.message);
  };

  const handleSaveBufferTime = async () => {
    try {
      setIsSaving(true);
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("BusinessTeam")
        .update({ bufferTime: parseInt(bufferTime) })
        .eq("businessId", selectedBusiness.id)
        .eq("userId", user.id);

      if (error) throw error;
      alert("Buffer time updated successfully!");
    } catch (error) {
      console.error("Error updating buffer time:", error.message);
      alert("Failed to update buffer time. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTimeChange = (day, index, field, value) => {
    setWorkTime((prev) => {
      const updatedWorkTime = { ...prev };
      if (!updatedWorkTime[day]) updatedWorkTime[day] = [];
      updatedWorkTime[day][index] = { ...updatedWorkTime[day][index], [field]: value };
      return updatedWorkTime;
    });
  };

  const handleAddTimeSlot = (day) => {
    setWorkTime((prev) => {
      const updatedWorkTime = { ...prev };
      updatedWorkTime[day] = [...(updatedWorkTime[day] || []), { start: "", end: "" }];
      return updatedWorkTime;
    });
  };

  const handleRemoveTimeSlot = (day, index) => {
    setWorkTime((prev) => {
      const updatedWorkTime = { ...prev };
      if (updatedWorkTime[day]) {
        updatedWorkTime[day] = updatedWorkTime[day].filter((_, i) => i !== index);
      }
      return updatedWorkTime;
    });
  };

  const handleSaveAllWorkTimes = async () => {
    try {
      setIsSaving(true);
      const { data: { user } } = await supabase.auth.getUser();

      const cleanWorkTime = {};
      for (const [day, slots] of Object.entries(workTime)) {
        cleanWorkTime[day] = slots.filter(slot => slot.start && slot.end);
      }

      const { error } = await supabase
        .from("BusinessTeam")
        .update({ worktime: cleanWorkTime })
        .eq("businessId", selectedBusiness.id)
        .eq("userId", user.id);

      if (error) throw error;
      alert("Work times updated successfully!");
    } catch (error) {
      console.error("Error updating work times:", error.message);
      alert("Failed to update work times. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const hasPermission = (permissionName) => {
    const permissionIds = {
      'settings_general': 12,
      'manage_themes': 15,
    };

    return userPermissions.includes(permissionIds[permissionName]);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "theme":
        return hasPermission('manage_themes') ? (
          <div>
            <h3 className="text-2xl font-semibold text-gray-800 mb-4">{translate('themes')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {themes.map((theme) => {
                const isUpgradeRequired = businessDetails.planId < theme.required_plan;

                return (
                  <div
                    key={theme.name}
                    className={`p-6 border rounded-lg shadow-md transition-all duration-200 hover:shadow-lg ${activeTheme === theme.name
                      ? "bg-accent text-white border-accent"
                      : "bg-white hover:border-accent"
                      }`}
                  >
                    <div className="flex flex-col h-full">
                      <div className="mb-4">
                        <h4 className="text-lg font-medium mb-2">{theme.name}</h4>
                        {theme.description && (
                          <p className={`text-sm ${activeTheme === theme.name ? 'text-white/80' : 'text-gray-600'}`}>
                            {theme.description}
                          </p>
                        )}
                      </div>

                      <div className="mt-auto">
                        {activeTheme === theme.name ? (
                          <div className="flex items-center text-white">
                            <svg
                              className="w-5 h-5 mr-2"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            <span>{translate('activeTheme')}</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              if (isUpgradeRequired) {
                                navigate('/dashboard/subscription');
                              } else {
                                handleThemeActivation(theme.name);
                              }
                            }}
                            className={`w-full px-4 py-2 rounded-md transition-colors ${isUpgradeRequired
                              ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                              : "bg-accent hover:bg-accent-dark text-white"
                              }`}
                            disabled={isSaving}
                          >
                            {isUpgradeRequired ? (
                              <div className="flex items-center justify-center">
                                <svg
                                  className="w-4 h-4 mr-2"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                                  />
                                </svg>
                                {translate('upgradePlan')}
                              </div>
                            ) : (
                              isSaving ? translate('activating') : translate('activateTheme')
                            )}
                          </button>
                        )}
                      </div>

                      {isUpgradeRequired && (
                        <div className="mt-2 text-xs text-yellow-600 bg-yellow-50 p-2 rounded">
                          {translate('availableInHigherPlan')}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : <div>{translate('noPermissionToManageThemes')}</div>;

      case "worktime":
        return (<div className="space-y-6">
          <h3 className="text-2xl font-semibold text-gray-800 mb-4">{translate('workTime')}</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
              <div key={day} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-lg font-medium text-gray-700">{translate(day.toLowerCase())}</h4>
                  <button
                    onClick={() => handleAddTimeSlot(day)}
                    className="text-sm bg-accent text-white px-3 py-1 rounded-md hover:bg-accent-dark"
                  >
                    + {translate('addSlot')}
                  </button>
                </div>

                <div className="space-y-3">
                  {(workTime[day] || []).map((time, index) => (
                    <div key={index} className="flex flex-wrap items-center gap-2 p-2 bg-gray-50 rounded-md">
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={time.start || ""}
                          onChange={(e) => handleTimeChange(day, index, "start", e.target.value)}
                          className="p-2 border border-gray-300 rounded-md text-sm"
                        />
                        <span className="text-gray-500">{translate('to')}</span>
                        <input
                          type="time"
                          value={time.end || ""}
                          onChange={(e) => handleTimeChange(day, index, "end", e.target.value)}
                          className="p-2 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                      <button
                        onClick={() => handleRemoveTimeSlot(day, index)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        {translate('remove')}
                      </button>
                    </div>
                  ))}
                  {(!workTime[day] || workTime[day].length === 0) && (
                    <p className="text-gray-500 text-sm italic">{translate('noTimeSlotsAdded')}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <button
              onClick={handleSaveAllWorkTimes}
              className={`w-full md:w-auto px-6 py-2 rounded-md text-white ${isSaving ? "bg-gray-400 cursor-not-allowed" : "bg-accent hover:bg-accent-dark"
                }`}
              disabled={isSaving}
            >
              {isSaving ? translate('saving') : translate('saveAllWorkTimes')}
            </button>
          </div>
        </div>)


      case "bufferTime":

        return (<div>
          <h3 className="text-2xl font-semibold text-gray-800 mb-4">{translate('bufferTime')}</h3>
          {isLoading ? (
            <p>{translate('loading')}</p>
          ) : (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">{translate('minutes')}</label>
                <input
                  type="number"
                  value={bufferTime}
                  onChange={(e) => setBufferTime(e.target.value)}
                  placeholder={translate('enterMinutesForBufferTime')}
                  className="mt-1 p-2 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-accent focus:border-accent"
                />
              </div>
              <button
                onClick={handleSaveBufferTime}
                className={`px-4 py-2 rounded-md text-white ${isSaving ? "bg-gray-400 cursor-not-allowed" : "bg-accent hover:bg-accent-dark"}`}
                disabled={isSaving}
              >
                {isSaving ? translate('saving') : translate('saveBufferTime')}
              </button>
            </>
          )}
        </div>)

      case "general":
        return hasPermission('settings_general') ? (
          <div>
            <h3 className="text-2xl font-semibold text-gray-800 mb-4">{translate('generalSettings')}</h3>
            {isLoading ? (
              <p>{translate('loading')}</p>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">{translate('name')}</label>
                  <input
                    type="text"
                    name="name"
                    value={businessDetails.name}
                    onChange={handleInputChange}
                    placeholder={translate('enterBusinessName')}
                    className="mt-1 p-2 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-accent focus:border-accent"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">{translate('language')}</label>
                  <select
                    name="language"
                    value={businessDetails.language}
                    onChange={handleInputChange}
                    className="mt-1 p-2 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-accent focus:border-accent"
                  >
                    <option value="english">English</option>
                    <option value="bulgarian">Bulgarian</option>
                  </select>
                </div>
                <button
                  onClick={handleSaveChanges}
                  className={`px-4 py-2 rounded-md text-white ${isSaving ? "bg-gray-400 cursor-not-allowed" : "bg-accent hover:bg-accent-dark"
                    }`}
                  disabled={isSaving}
                >
                  {isSaving ? translate('saving') : translate('saveChanges')}
                </button>
              </>
            )}
          </div>
        ) : <div>{translate('noPermissionToManageGeneralSettings')}</div>;

      default:
        return null;
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold text-accent mb-6">{translate('settings')}</h2>
      {isLoading ? (
        <div className="text-center">{translate('loading')}</div>
      ) : (
        <>
          <div className="flex gap-4">
            {hasPermission('settings_general') && (
              <button
                onClick={() => setActiveTab("general")}
                className={`px-4 py-2 rounded-t-md ${activeTab === "general" ? "bg-accent text-white" : "bg-gray-200 text-gray-700"
                  }`}
              >
                {translate('general')}
              </button>
            )}
            <button
              onClick={() => setActiveTab("worktime")}
              className={`px-4 py-2 rounded-t-md ${activeTab === "worktime" ? "bg-accent text-white" : "bg-gray-200 text-gray-700"}`}
            >
              {translate('workTime')}
            </button>
            <button
              onClick={() => setActiveTab("bufferTime")}
              className={`px-4 py-2 rounded-t-md ${activeTab === "bufferTime" ? "bg-accent text-white" : "bg-gray-200 text-gray-700"}`}
            >
              {translate('bufferTime')}
            </button>
            {hasPermission('manage_themes') && (
              <button
                onClick={() => setActiveTab("theme")}
                className={`px-4 py-2 rounded-t-md ${activeTab === "theme" ? "bg-accent text-white" : "bg-gray-200 text-gray-700"}`}
              >
                {translate('themes')}
              </button>
            )}
          </div>
          <div className="bg-white p-4 rounded-md">
            {renderTabContent()}
          </div>
        </>
      )}
    </div>
  );
};

export default Settings;