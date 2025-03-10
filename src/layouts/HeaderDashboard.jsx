import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaBars, FaPlus } from "react-icons/fa";
import supabase from "../hooks/supabase"; // Import Supabase client
import LanguageSelector from '../components/LanguageSelector';
import { useLanguage } from '../contexts/LanguageContext';
import { motion } from "framer-motion"; // Import Framer Motion

const HeaderDashboard = ({ onSidebarToggle }) => {
  const [isBusinessDropdownOpen, setIsBusinessDropdownOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userProfile, setUserProfile] = useState({ firstName: "", avatar: "" });
  const [businessInvites, setBusinessInvites] = useState([]);

  const navigate = useNavigate();
  const { translate, setLanguage } = useLanguage();

  const [selectedBusiness, setSelectedBusiness] = useState(() => {
    const savedBusiness = localStorage.getItem("selectedBusiness");
    return savedBusiness ? JSON.parse(savedBusiness) : { id: null, name: translate("selectBusiness") };
  });

  const businessDropdownRef = useRef(null);
  const profileDropdownRef = useRef(null);

  const toggleBusinessDropdown = () => {
    setIsBusinessDropdownOpen(!isBusinessDropdownOpen);
  };

  const toggleProfileDropdown = () => {
    setIsProfileDropdownOpen(!isProfileDropdownOpen);
  };

  const closeDropdowns = () => {
    setIsBusinessDropdownOpen(false);
    setIsProfileDropdownOpen(false);
  };

  useEffect(() => {
    const fetchUserData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Get the logged-in user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          window.location.href = "/login";
          return;
        }

        // Fetch user profile from Users table
        const { data: userProfileData, error: userProfileError } = await supabase
          .from("Users")
          .select("first_name, avatar")
          .eq("id", user.id)
          .single();

        if (userProfileError) throw new Error(userProfileError.message);

        setUserProfile({
          firstName: userProfileData.first_name,
          avatar: userProfileData.avatar,
        });

        // Fetch both businesses and invites in parallel
        const [businessTeamsResponse, invitesResponse] = await Promise.all([
          supabase
            .from("BusinessTeam")
            .select("businessId, Business(name)")
            .eq("userId", user.id),
          supabase
            .from("businessteaminvites")
            .select(`
              id,
              businessid,
              permissions,
              token,
              Business (
                name
              )
            `)
            .eq("email", user.email)
            .gte("expires_at", new Date().toISOString())
        ]);

        if (businessTeamsResponse.error) throw new Error(businessTeamsResponse.error.message);
        if (invitesResponse.error) throw new Error(invitesResponse.error.message);

        const formattedBusinesses = businessTeamsResponse.data.map(({ businessId, Business }) => ({
          id: businessId,
          name: Business.name,
        }));

        setBusinesses(formattedBusinesses);
        setBusinessInvites(invitesResponse.data);

        // If no businesses and no invites, redirect to create-business
        if (formattedBusinesses.length === 0 && invitesResponse.data.length === 0) {
          navigate("/create-business");
          return;
        }

        // Handle business selection
        const savedBusiness = localStorage.getItem("selectedBusiness");
        
        if (!savedBusiness && formattedBusinesses.length > 0) {
          // If no business is selected, select the first business
          const firstBusiness = { id: formattedBusinesses[0].id, name: formattedBusinesses[0].name };
          setSelectedBusiness(firstBusiness);
          localStorage.setItem("selectedBusiness", JSON.stringify(firstBusiness));
        }
        // Automatically select the sole business if there's only one
        else if (formattedBusinesses.length === 1) {
          const soleBusiness = { id: formattedBusinesses[0].id, name: formattedBusinesses[0].name };
          setSelectedBusiness(soleBusiness);
          localStorage.setItem("selectedBusiness", JSON.stringify(soleBusiness));
        }

      } catch (err) {
        setError(err.message || translate("errorFetchingBusinesses"));
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigate, translate]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        businessDropdownRef.current &&
        !businessDropdownRef.current.contains(event.target) &&
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target)
      ) {
        closeDropdowns();
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const handleBusinessSelect = (business) => {
    const selected = { id: business.id, name: business.name };
    setSelectedBusiness(selected);
    setIsBusinessDropdownOpen(false);
    localStorage.setItem("selectedBusiness", JSON.stringify(selected));
    
    // Refresh the page to update all components with new business data
    window.location.reload();
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
  
      // Clear local storage and force a redirect to login
      localStorage.clear();
      window.location.href = "/login"; // Use window.location.href for immediate redirection
    } catch (err) {
      console.error(translate("errorSigningOut"), err.message);
      alert(translate("failedSignOut"));
    }
  };

  // Fallback for the profile image: if avatar is not available, use first letter of first name
  const profileInitial = userProfile.avatar ? (
    <img
      src={userProfile.avatar}
      alt={translate("avatar")}
      className="w-8 h-8 rounded-full"
    />
  ) : (
    <div className="w-8 h-8 bg-accent text-white flex items-center justify-center rounded-full">
      {userProfile.firstName.charAt(0).toUpperCase()}
    </div>
  );

  const handleLanguageChange = (event) => {
    setLanguage(event.target.value); // Set language based on user selection
  };

  const handleAcceptInvite = async (invite) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // First create the BusinessTeam entry
      const { data: businessTeam, error: teamError } = await supabase
        .from("BusinessTeam")
        .insert({
          userId: user.id,
          businessId: invite.businessid,
          worktime: invite.permissions?.worktime || null,
          bufferTime: invite.permissions?.bufferTime || null
        })
        .select('id')
        .single();

      if (teamError) throw new Error(teamError.message);

      // Insert permissions from the invite directly into BusinessTeam_Permissions
      if (invite.permissions?.permissionIds?.length > 0) {
        const permissionsToInsert = invite.permissions.permissionIds.map(permissionId => ({
          businessTeamId: businessTeam.id,
          permissionId: permissionId
        }));

        const { error: permInsertError } = await supabase
          .from("BusinessTeam_Permissions")
          .insert(permissionsToInsert);

        if (permInsertError) throw new Error(permInsertError.message);
      }

      // Delete the invite
      const { error: deleteError } = await supabase
        .from("businessteaminvites")
        .delete()
        .eq("id", invite.id);

      if (deleteError) throw new Error(deleteError.message);

      // Update businesses list
      const { data: newBusiness } = await supabase
        .from("Business")
        .select("id, name")
        .eq("id", invite.businessid)
        .single();

      if (newBusiness) {
        setBusinesses(prev => [...prev, { id: newBusiness.id, name: newBusiness.name }]);
        
        // Set as selected business if it's the first one
        if (businesses.length === 0) {
          const selected = { id: newBusiness.id, name: newBusiness.name };
          setSelectedBusiness(selected);
          localStorage.setItem("selectedBusiness", JSON.stringify(selected));
        }
      }

      // Remove the invite from the list
      setBusinessInvites(prev => prev.filter(inv => inv.id !== invite.id));

      // Show success message
      alert(translate("inviteAcceptedSuccessfully"));

      // Refresh the page to update all components
      window.location.reload();
    } catch (err) {
      console.error("Error accepting invite:", err);
      alert(translate("errorAcceptingInvite"));
    }
  };

  return (
    <>
      {loading && (
        <motion.div 
          className="fixed inset-0 flex items-center justify-center bg-white z-50"
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          transition={{ duration: 0.5 }}
        >
          <motion.div 
            className="loader"
            initial={{ rotate: 0 }} 
            animate={{ rotate: 360 }} 
            transition={{ duration: 1, repeat: Infinity }}
          >
            <div className="border-8 border-t-8 border-gray-300 border-t-accent rounded-full w-16 h-16"></div>
          </motion.div>
        </motion.div>
      )}
      <header className={`bg-white sticky top-0 z-20 shadow-md w-full ${loading ? 'hidden' : ''}`}>
        <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
          <button
            className="md:hidden p-2 text-gray-600 hover:text-gray-800"
            onClick={onSidebarToggle}
          >
            <FaBars className="text-2xl" />
          </button>

          <div
            className="relative flex-1 flex items-center justify-center md:justify-start"
            ref={businessDropdownRef}
          >
            <button
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-600"
              onClick={toggleBusinessDropdown}
            >
              <span className="truncate">{selectedBusiness.name}</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`w-4 h-4 transform transition-transform ${isBusinessDropdownOpen ? "rotate-180" : ""}`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 10.707l3.71-3.475a.75.75 0 111.02 1.1l-4 3.75a.75.75 0 01-1.02 0l-4-3.75a.75.75 0 01.02-1.062z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            {isBusinessDropdownOpen && (
              <div
                className="absolute top-full left-0 mt-2 w-64 bg-white shadow-lg rounded-md border divide-y divide-gray-100 z-30"
                style={{ minWidth: "12rem" }}
              >
                {loading ? (
                  <div className="block px-4 py-2 text-sm text-gray-500">{translate("loading")}</div>
                ) : error ? (
                  <div className="block px-4 py-2 text-sm text-red-500">{error}</div>
                ) : businesses.length > 0 ? (
                  <ul>
                    {businesses.map((business) => (
                      <li
                        key={business.id}
                        className="block px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleBusinessSelect(business)}
                      >
                        {business.name}
                      </li>
                    ))}
                  </ul>
                ) : businessInvites.length > 0 ? (
                  <>
                    <div className="block px-4 py-2 text-sm text-gray-700 font-medium">
                      {translate("pendingInvites")}
                    </div>
                    <ul>
                      {businessInvites.map((invite) => (
                        <li
                          key={invite.id}
                          className="flex items-center justify-between px-4 py-2 text-sm text-gray-500 hover:bg-gray-50"
                        >
                          <span>{invite.Business.name}</span>
                          <button
                            onClick={() => handleAcceptInvite(invite)}
                            className="text-accent hover:text-accent-dark"
                          >
                            {translate("accept")}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <div className="block px-4 py-2 text-sm text-gray-500">
                    {translate("noBusinessesAvailable")}
                  </div>
                )}
                <div
                  className="flex items-center px-4 py-2 text-sm text-accent hover:bg-itemsHover cursor-pointer"
                  onClick={() => window.location.href = "/create-business"}
                >
                  <FaPlus className="mr-2" />
                  {translate("createBusiness")}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <LanguageSelector />
            <div className="relative" ref={profileDropdownRef}>
              <button
                className="overflow-hidden rounded-full border border-gray-300 shadow-inner"
                onClick={toggleProfileDropdown}
              >
                <span className="sr-only">{translate("toggleProfileMenu")}</span>
                {profileInitial}
              </button>
              {isProfileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white shadow-lg rounded-md border divide-y divide-gray-100 z-30">
                  <div className="p-2">
                    <Link
                      to="/dashboard/profile"
                      className="block px-4 py-2 text-sm text-gray-500 hover:bg-gray-50"
                      onClick={closeDropdowns}
                    >
                      {translate("myProfile")}
                    </Link>
                  </div>
                  <div className="p-2">
                    <button
                      className="block w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                      onClick={handleSignOut}
                    >
                      {translate("signOut")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
};

export default HeaderDashboard;