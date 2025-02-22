import React, { useState, useEffect, useMemo } from "react";
import { FaEdit, FaTrashAlt, FaUserShield } from "react-icons/fa";
import { useNavigate } from "react-router-dom"; // To navigate to the subscription page
import supabase from "../hooks/supabase"; // Import Supabase client
import { track } from "framer-motion/client";
import { useLanguage } from "../contexts/LanguageContext";
import { v4 as uuidv4 } from 'uuid'; // Add this import
import axios from 'axios';
import { useToast } from '../contexts/ToastContext';
import { BACKEND_EMAIL_URL, FRONTEND_URL } from '../config/config';

const Teams = () => {
  const { translate } = useLanguage();
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMember, setNewMember] = useState({
    email: "",
    permissions: [],
  });
  const [teamMembers, setTeamMembers] = useState([]);
  const [permissionsList, setPermissionsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);
  const [editingMemberPermissions, setEditingMemberPermissions] = useState(null);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState(null);
  const [userPermissions, setUserPermissions] = useState([]); // Track the logged-in user's permissions
  const [plan, setPlan] = useState(null); // Store the plan information
  const [teamSizeLimit, setTeamSizeLimit] = useState(0); // Store the team size limit
  const [isTeamSizeLimitReached, setIsTeamSizeLimitReached] = useState(false); // Check if team size limit is reached
  const [isSaving, setIsSaving] = useState(false);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [showDeleteInviteDialog, setShowDeleteInviteDialog] = useState(false);
  const [inviteToDelete, setInviteToDelete] = useState(null);
  const [currentTeamSize, setCurrentTeamSize] = useState(0);
  const [totalPendingAndActive, setTotalPendingAndActive] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferToMember, setTransferToMember] = useState(null);
  const [businessOwnerId, setBusinessOwnerId] = useState(null);
  const [businessOwnerEmail, setBusinessOwnerEmail] = useState(null); // State to hold owner's email
  const [businessDetails, setBusinessDetails] = useState(null); // State to hold business details

  const navigate = useNavigate(); // For navigation to the subscription page

  const selectedBusiness = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("selectedBusiness")) || {};
    } catch (error) {
      console.error("Invalid business data in local storage", error);
      return {};
    }
  }, []);

  // Fetch team members with permissions
  const fetchTeamMembers = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error } = await supabase
        .from("BusinessTeam")
        .select(`
          id, 
          userId,
          Users (
            first_name,
            last_name,
            avatar,
            email
          ),
          BusinessTeam_Permissions (
            id,
            permissionId,
            Permissions (
              id, 
              permission
            )
          )
        `)
        .eq("businessId", selectedBusiness.id);

      if (error) throw new Error(error.message);
      setTeamMembers(data);
    } catch (error) {
      setError(error.message || "Error fetching team members.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch available permissions
  const fetchPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from("Permissions")
        .select("id, permission");
      if (error) throw new Error(error.message);
      setPermissionsList(data);
    } catch (error) {
      setError(error.message || "Error fetching permissions.");
    }
  };

  // Fetch user permissions with names
  const fetchUserPermissions = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw new Error(userError.message);

      const userId = user.id;
      const businessId = selectedBusiness.id;

      const { data: businessTeamData, error: businessTeamError } = await supabase
        .from("BusinessTeam")
        .select("id")
        .eq("userId", userId)
        .eq("businessId", businessId)
        .single();

      if (businessTeamError) throw new Error(businessTeamError.message);

      const businessTeamId = businessTeamData.id;

      const { data: permissionsData, error: permissionsError } = await supabase
        .from("BusinessTeam_Permissions")
        .select("permissionId")
        .eq("businessTeamId", businessTeamId);

      if (permissionsError) throw new Error(permissionsError.message);

      setUserPermissions(permissionsData.map((p) => p.permissionId));
    } catch (error) {
      setError(error.message || "Error fetching user permissions.");
    }
  };

  // Fetch business plan and team size limit
  const fetchBusinessPlan = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("Business")
        .select("planId")
        .eq("id", selectedBusiness.id)
        .single();

      if (error) throw new Error(error.message);

      // If no planId, redirect to subscription page
      if (!data.planId) {
        navigate("/dashboard/subscription");
        return;
      }

      const { data: planData, error: planError } = await supabase
        .from("Plans")
        .select("*")
        .eq("id", data.planId)
        .single();

      if (planError) throw new Error(planError.message);

      // If plan data is not found, redirect to subscription page
      if (!planData) {
        navigate("/dashboard/subscription");
        return;
      }

      setPlan(planData);
      setTeamSizeLimit(planData.team_size);
      await fetchTeamMembers();

    } catch (error) {
      console.error("Error fetching plan information:", error);
      // Redirect to subscription page on error
      navigate("/dashboard/subscription");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (teamSizeLimit == null) return; // Ensure teamSizeLimit is defined before checking

    if (Number(teamSizeLimit) === -1) {
      setIsTeamSizeLimitReached(false);
    } else {
      setIsTeamSizeLimitReached(teamMembers.length >= Number(teamSizeLimit));
    }
  }, [teamMembers, teamSizeLimit]);

  // Add permission ID mapping
  const PERMISSION_IDS = {
    VIEW_SETTINGS: 16,
    MANAGE_GENERAL_SETTINGS: 12,
    MANAGE_THEMES: 15,
    MANAGE_TEAM: 13,      // Permission to delete team members
    EDIT_PERMISSIONS: 14
  };

  const handleAddMember = async () => {
    if (!newMember.email) {
      showToast('Please enter an email address', 'error');
      return;
    }

    if (isSubmitting) return;

    // Check team size limit
    if (teamSizeLimit !== -1 && totalPendingAndActive >= teamSizeLimit) {
      showToast('Team size limit reached. Please upgrade your plan.', 'error');
      navigate("/dashboard/subscription");
      return;
    }

    // Check existing invites
    const existingInvite = pendingInvites.find(
      invite => invite.email.toLowerCase() === newMember.email.toLowerCase()
    );
    if (existingInvite) {
      showToast('An invitation has already been sent to this email', 'error');
      return;
    }

    // Check existing members
    const existingMember = teamMembers.find(
      member => member.Users.email.toLowerCase() === newMember.email.toLowerCase()
    );
    if (existingMember) {
      showToast('This email is already a team member', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Generate invite token
      const token = uuidv4();

      // Create the invite first
      const { error: inviteError } = await supabase
        .from("businessteaminvites")
        .insert([{
          email: newMember.email.toLowerCase(),
          businessid: selectedBusiness.id,
          permissions: newMember.permissions,
          token: token
        }]);

      if (inviteError) throw new Error(inviteError.message);

      // Check if user exists
      const { data: userData } = await supabase
        .from("Users")
        .select("id")
        .eq("email", newMember.email)
        .single();

      // Generate invite link based on whether user exists
      const inviteLink = `${FRONTEND_URL}${userData ? '/dashboard' : '/register'}?token=${token}&business=${selectedBusiness.id}`;

      try {
        // Send invite email
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await axios.post(`${BACKEND_EMAIL_URL}/invite-team-member`, {
          business: selectedBusiness.name,
          email: newMember.email,
          link: inviteLink
        }, {
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.status !== 200) {
          throw new Error('Failed to send invitation email');
        }

        setNewMember({ email: "", permissions: [] });
        setShowAddMember(false);
        await fetchPendingInvites();
        showToast(`Invitation sent to ${newMember.email}`, 'success');

        // Redirect to the team members page or dashboard
      } catch (emailError) {
        // If email fails, delete the invite
        await supabase
          .from("businessteaminvites")
          .delete()
          .eq("token", token);
        
        throw new Error('Failed to send invitation email. Please try again.');
      }
    } catch (error) {
      showToast(error.message || 'Error sending invitation', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasPermission = (member, permissionId) => {
    return member.BusinessTeam_Permissions.some(permission => permission.permissionId === permissionId);
  };

  const handleRemoveMember = async () => {
    try {
      const { error } = await supabase
        .from("BusinessTeam")
        .delete()
        .eq("id", memberToDelete.id);

      if (error) throw new Error(error.message);

      await fetchTeamMembers();
      setShowDeleteConfirmDialog(false);
      showToast(`Team member ${memberToDelete.Users.first_name} has been removed successfully`, 'success');
    } catch (error) {
      showToast(error.message || 'Error removing member', 'error');
    }
  };

  const openPermissionsDialog = (member) => {
    setEditingMemberPermissions({
      ...member,
      permissions: member.BusinessTeam_Permissions.map((p) => p.permissionId),
    });
    setShowPermissionsDialog(true);  // Open dialog
  };

  // Utility function to get the first letter of first name if avatar is not available
  const getAvatarOrInitial = (member) => {
    if (member.Users.avatar) {
      return (
        <img 
          src={member.Users.avatar} 
          alt={`${member.Users.first_name}'s avatar`}
          className="w-10 h-10 rounded-full object-cover"
          onError={(e) => {
            e.target.onerror = null; // Prevent infinite loop
            e.target.src = `https://ui-avatars.com/api/?name=${member.Users.first_name}+${member.Users.last_name}&background=random`;
          }}
        />
      );
    }
    
    // If no avatar, use UI Avatars API to generate one based on name
    return (
      <img 
        src={`https://ui-avatars.com/api/?name=${member.Users.first_name}+${member.Users.last_name}&background=random`}
        alt={`${member.Users.first_name}'s avatar`}
        className="w-10 h-10 rounded-full"
      />
    );
  };

  // Handle redirect to the subscription page
  const handleUpgradeClick = () => {
    navigate("/dashboard/subscription");
  };

  const handlePermissionsChange = (permissionId) => {
    setEditingMemberPermissions(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(p => p !== permissionId)
        : [...prev.permissions, permissionId]
    }));
  };

  const handleUpdatePermissions = async () => {
    try {
      setIsSaving(true);

      // Delete existing permissions
      const { error: deleteError } = await supabase
        .from("BusinessTeam_Permissions")
        .delete()
        .eq("businessTeamId", editingMemberPermissions.id);

      if (deleteError) throw new Error(deleteError.message);

      // Insert new permissions if any are selected
      if (editingMemberPermissions.permissions.length > 0) {
        const permissionsToInsert = editingMemberPermissions.permissions.map(permissionId => ({
          businessTeamId: editingMemberPermissions.id,
          permissionId: permissionId
        }));

        const { error: insertError } = await supabase
          .from("BusinessTeam_Permissions")
          .insert(permissionsToInsert);

        if (insertError) throw new Error(insertError.message);
      }

      setShowPermissionsDialog(false);
      await fetchTeamMembers();
      showToast(`Permissions updated for ${editingMemberPermissions.Users.first_name}`, 'success');
    } catch (error) {
      console.error("Error updating permissions:", error);
      showToast('Error updating permissions. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Add this function to fetch and display pending invites
  const fetchPendingInvites = async () => {
    try {
      const { data, error } = await supabase
        .from("businessteaminvites")
        .select("*")
        .eq("businessid", selectedBusiness.id);

      if (error) throw error;
      setPendingInvites(data || []);
    } catch (error) {
      console.error("Error fetching pending invites:", error);
      setError("Error fetching pending invites");
    }
  };

  // Add this function to fetch the current user's ID
  const fetchCurrentUser = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      setCurrentUserId(user.id);
    } catch (error) {
      console.error("Error fetching current user:", error);
    }
  };

  // Add this function to handle invite deletion
  const handleDeleteInvite = async () => {
    try {
      const { error } = await supabase
        .from("businessteaminvites")
        .delete()
        .eq("token", inviteToDelete.token);

      if (error) throw error;

      await fetchPendingInvites();
      setShowDeleteInviteDialog(false);
      setInviteToDelete(null);
      showToast(`Invitation for ${inviteToDelete.email} has been cancelled`, 'success');
    } catch (error) {
      console.error("Error deleting invite:", error);
      showToast('Error deleting invitation. Please try again.', 'error');
    }
  };

  // Add this function to calculate team sizes
  const calculateTeamSizes = () => {
    const activeMembers = teamMembers.length;
    const pendingMembers = pendingInvites.length;
    const total = activeMembers + pendingMembers;

    setCurrentTeamSize(activeMembers);
    setTotalPendingAndActive(total);
  };

  // Update useEffect to calculate sizes when data changes
  useEffect(() => {
    calculateTeamSizes();
  }, [teamMembers, pendingInvites]);

  // Fetch business details for general settings
  const fetchBusinessDetails = async () => {
    try {
      const { data, error } = await supabase
        .from("Business")
        .select("name, language, planId")
        .eq("id", selectedBusiness.id)
        .single();

      if (error) throw new Error(error.message);

      // Set the business details in state or handle them as needed
      setBusinessDetails(data);
    } catch (error) {
      console.error("Error fetching business details:", error);
    }
  };

  // Update useEffect to include fetching business details
  useEffect(() => {
    if (selectedBusiness?.id) {
      fetchCurrentUser();
      fetchTeamMembers();
      fetchPermissions();
      fetchUserPermissions();
      fetchBusinessPlan();
      fetchPendingInvites();
      fetchBusinessDetails(); // Fetch business details for general settings
    }
  }, [selectedBusiness?.id]);

  // Update the permissions display in the team members table
  const renderPermissionsList = (permissions) => {
    const permissionNames = {
      12: translate("settings_general"),
      13: translate("manage_delete"),
      14: translate("manage_permisisons"),
      15: translate("manage_themes"),
    };

    return permissions.map((permission) => (
      <span
        key={permission.id}
        className="inline-block bg-gray-100 rounded-full px-3 py-1 text-sm font-semibold text-gray-700 mr-2 mb-2"
      >
        {permissionNames[permission.Permissions.id] || permission.Permissions.permission}
      </span>
    ));
  };

  // Add this CSS class utility at the top of the component
  const cardStyles = {
    base: "bg-white rounded-lg shadow p-4 mb-4",
    header: "flex items-center space-x-4 mb-4",
    content: "space-y-2",
    label: "text-sm text-gray-500",
    value: "text-gray-900",
    actions: "flex justify-end space-x-3 mt-4 pt-4 border-t"
  };

  // Fetch invitation details
  const fetchInvitationDetails = async (businessInviteId) => {
    try {
      const { data, error } = await supabase
        .from("businessteaminvites")
        .select("*")
        .eq("id", businessInviteId)
        .single(); // Expect a single row

      if (error) {
        console.error("Error fetching invitation details:", error);
        return; // Handle error
      }

      if (!data) {
        console.error("No invitation found for the provided ID.");
        return; // Handle no data case
      }

      // Proceed with using the invitation data
      // ...
    } catch (err) {
      console.error("Unexpected error:", err);
    }
  };

  const acceptInvite = async (token, businessId) => {
    try {
      const { data, error } = await supabase
        .from("businessteaminvites")
        .select("*")
        .eq("token", token)
        .eq("businessid", businessId)
        .single(); // Expect a single row

      if (error) {
        console.error("Error fetching invitation details:", error);
        return; // Handle error
      }

      if (!data) {
        console.error("No invitation found for the provided token and business ID.");
        return; // Handle no data case
      }

      // Proceed with accepting the invite (e.g., add user to the business)
      // ...
    } catch (err) {
      console.error("Unexpected error:", err);
    }
  };

  // Add this function to handle ownership transfer
  const handleTransferOwnership = async () => {
    console.log("Transferring ownership to:", transferToMember);
    try {
      if (!transferToMember) return;

      const { error } = await supabase
        .from("Business")
        .update({ owner_id: transferToMember.userId })
        .eq("id", selectedBusiness.id);

      if (error) throw error;

      showToast(`Ownership transferred to ${transferToMember.Users.first_name}`, 'success');
      setShowTransferDialog(false);
      setTransferToMember(null);
      // Refresh the page or redirect to reflect the changes
      window.location.reload();
    } catch (error) {
      console.error("Error transferring ownership:", error);
      showToast('Error transferring ownership. Please try again.', 'error');
    }
  };

  // Check if a member is the owner
  const isOwner = (member) => {
    return member.userId === businessOwnerId;
  };

  // Check if current user is the owner
  const currentUserIsOwner = () => {
    return currentUserId === businessOwnerId;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        
        console.log("Current User ID:", user.id);
        setCurrentUserId(user.id);

        // Fetch business to get owner_id
        const { data: businessData, error: businessError } = await supabase
          .from("Business")
          .select("owner_id")
          .eq("id", selectedBusiness.id)
          .single();
        
        if (businessError) throw businessError;
        
        console.log("Business Data:", businessData);
        console.log("Business Owner ID:", businessData.owner_id);
        setBusinessOwnerId(businessData.owner_id);

        // Fetch the owner's email
        const { data: ownerData, error: ownerError } = await supabase
          .from("Users")
          .select("email")
          .eq("id", businessData.owner_id)
          .single();

        if (ownerError) throw ownerError;

        console.log("Business Owner Email:", ownerData.email); // Log the owner's email
        setBusinessOwnerEmail(ownerData.email); // Store the owner's email

        // Fetch team members with their user details
        const { data: teamData, error: teamError } = await supabase
          .from("BusinessTeam")
          .select(`
            id,
            userId,
            businessId,
            Users (
              id,
              first_name,
              last_name,
              email,
              avatar
            ),
            BusinessTeam_Permissions (
              id,
              permissionId,
              Permissions (
                id,
                permission
              )
            )
          `)
          .eq("businessId", selectedBusiness.id);

        if (teamError) throw teamError;
        
        console.log("Team Members:", teamData);
        setTeamMembers(teamData);

      } catch (error) {
        console.error("Error fetching data:", error);
        showToast('Error loading team members', 'error');
      }
    };

    fetchData();
  }, [selectedBusiness.id]);

  return (
    <div className="p-6 bg-primary min-h-screen">
      <h2 className="text-4xl font-bold text-accent mb-6">{translate('manageTeam')}</h2>

      {/* Add Team Size Information */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <div className="flex flex-wrap gap-6">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              {translate('teamSize')}
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold text-accent">
                {totalPendingAndActive}
              </span>
              <span className="text-gray-500">
                / {teamSizeLimit === -1 ? '∞' : teamSizeLimit}
              </span>
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {translate('activeMembers')}: {currentTeamSize}
            </div>
            <div className="text-sm text-gray-500">
              {translate('pendingInvites')}: {pendingInvites.length}
            </div>
          </div>
          
        </div>
      </div>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      {/* Add Team Member Button */}
      {plan && (
        <button
          onClick={() => {
            if (totalPendingAndActive >= teamSizeLimit && teamSizeLimit !== -1) {
              navigate("/dashboard/subscription");
            } else {
              setShowAddMember(!showAddMember);
            }
          }}
          className={`px-5 py-2 mb-6 ${
            totalPendingAndActive >= teamSizeLimit && teamSizeLimit !== -1
              ? "bg-gray-400 cursor-pointer text-white"
              : "bg-accent text-white"
          } font-semibold rounded-lg shadow-lg hover:scale-105 transition-transform`}
        >
          {totalPendingAndActive >= teamSizeLimit && teamSizeLimit !== -1
            ? translate('upgrade')
            : showAddMember
            ? translate('cancelAddMember')
            : translate('addMember')}
        </button>
      )}

      {/* Add Member Form */}
      {showAddMember && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6 max-w-md mx-auto">
          <h3 className="text-2xl font-semibold text-gray-800 mb-4">{translate('addMember')}</h3>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">{translate('email')}</label>
            <input
              type="email"
              placeholder={translate('enterEmail')}
              value={newMember.email}
              onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
              className="mt-1 p-2 block w-full border border-gray-300 rounded-md"
            />
          </div>
          <div className="mb-4">
            <label className="block mb-3 text-sm font-medium text-gray-700">{translate('permissions')}</label>
            <div className="flex flex-wrap gap-2">
              {permissionsList.map((permission) => (
                <label key={permission.id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newMember.permissions.includes(permission.id)}
                    onChange={() => {
                      setNewMember((prev) => {
                        const { permissions } = prev;
                        if (permissions.includes(permission.id)) {
                          return { ...prev, permissions: permissions.filter((p) => p !== permission.id) };
                        }
                        return { ...prev, permissions: [...permissions, permission.id] };
                      });
                    }}
                    className="mr-2"
                  />
                  {translate(permission.permission)}
                </label>
              ))}
            </div>
          </div>
          <button
            onClick={handleAddMember}
            disabled={isSubmitting}
            className={`px-4 py-2 ${
              isSubmitting 
                ? "bg-gray-400 cursor-not-allowed" 
                : "bg-green-500 hover:bg-green-600"
            } text-white rounded-md`}
          >
            {isSubmitting ? "Adding..." : translate('addMember')}
          </button>
        </div>
      )}

      {/* Team Members Section */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-2xl font-semibold text-gray-800 mb-4">{translate('teamMembers')}</h3>
        {loading ? (
          <p>{translate('loading')}</p>
        ) : teamMembers.length > 0 ? (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full table-auto">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-4 text-left">{translate('avatar')}</th>
                    <th className="p-4 text-left">{translate('name')}</th>
                    <th className="p-4 text-left">{translate('email')}</th>
                    <th className="p-4 text-left">{translate('permissions')}</th>
                    <th className="p-4 text-center">{translate('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {teamMembers.map((member) => {
                    const memberIsOwner = isOwner(member);
                    const userIsOwner = currentUserIsOwner();
                    const isCurrentUser = member.userId === currentUserId; // Check if the member is the current user

                    console.log("Rendering member:", {
                      name: member.Users.first_name,
                      isOwner: memberIsOwner,
                      currentUserIsOwner: userIsOwner,
                      isCurrentUser: isCurrentUser
                    });

                    return (
                      <tr key={member.id} className="border-t hover:bg-gray-50">
                        <td className="p-4">
                          <div className="flex items-center justify-center">
                            {getAvatarOrInitial(member)}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="font-medium">{`${member.Users.first_name} ${member.Users.last_name}`}</span>
                            <span className="text-sm text-gray-500">{member.Users.email}</span>
                          </div>
                        </td>
                        <td className="p-4">{member.Users.email}</td>
                        <td className="p-4">
                          <div className="flex flex-wrap">
                            {renderPermissionsList(member.BusinessTeam_Permissions)}
                            
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex justify-center items-center space-x-3">
                            {/* Owner Badge */}
                            {memberIsOwner && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                                {translate('owner')}
                              </span>
                            )}
                            
                            {/* Transfer Ownership Button - Only visible to owner when viewing other members */}
                            {userIsOwner && !memberIsOwner && (
                              <button
                                onClick={() => {
                                  setTransferToMember(member);
                                  setShowTransferDialog(true);
                                }}
                                className="p-2 text-blue-600 hover:bg-blue-100 rounded-full transition-all duration-200"
                                title={translate('transferOwnership')}
                              >
                                <FaUserShield className="w-5 h-5" />
                              </button>
                            )}

                            {/* Edit Permissions Button - Hidden for owner and current user */}
                            {!isCurrentUser && !memberIsOwner && (
                              <button
                                onClick={() => openPermissionsDialog(member)}
                                className="p-2 text-accent hover:text-accentHover rounded-full transition-all duration-200"
                                title="Edit permissions"
                              >
                                <FaEdit className="w-5 h-5" />
                              </button>
                            )}

                            {/* Delete Button - Hidden for owner and current user */}
                            {!isCurrentUser && !memberIsOwner && (
                              <button
                                onClick={() => {
                                  setMemberToDelete(member);
                                  setShowDeleteConfirmDialog(true);
                                }}
                                className="p-2 text-red-600 hover:bg-red-100 rounded-full transition-all duration-200"
                                title="Delete member"
                              >
                                <FaTrashAlt className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {teamMembers.map((member) => {
                const memberIsOwner = isOwner(member);
                const userIsOwner = currentUserIsOwner();
                const isCurrentUser = member.userId === currentUserId; // Check if the member is the current user

                return (
                  <div key={member.id} className={cardStyles.base}>
                    <div className={cardStyles.header}>
                      {getAvatarOrInitial(member)}
                      <div>
                        <h4 className="font-medium">{`${member.Users.first_name} ${member.Users.last_name}`}</h4>
                        <p className="text-sm text-gray-500">{member.Users.email}</p>
                      </div>
                    </div>
                    
                    <div className={cardStyles.content}>
                      <div>
                        <p className={cardStyles.label}>{translate('permissions')}</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {renderPermissionsList(member.BusinessTeam_Permissions)}
                        </div>
                      </div>
                    </div>

                    <div className={cardStyles.actions}>
                      {memberIsOwner && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                          {translate('owner')}
                        </span>
                      )}
                      
                      {/* Transfer Ownership Button - Only visible to owner when viewing other members */}
                      {userIsOwner && !memberIsOwner && (
                        <button
                          onClick={() => {
                            setTransferToMember(member);
                            setShowTransferDialog(true);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-full transition-all duration-200"
                          title={translate('transferOwnership')}
                        >
                          <FaUserShield className="w-5 h-5" />
                        </button>
                      )}

                      {/* Edit Permissions Button - Hidden for owner and current user */}
                      {!isCurrentUser && !memberIsOwner && (
                        <button
                          onClick={() => openPermissionsDialog(member)}
                          className="p-2 text-accent hover:text-accentHover rounded-full transition-all duration-200"
                          title="Edit permissions"
                        >
                          <FaEdit className="w-5 h-5" />
                        </button>
                      )}

                      {/* Delete Button - Hidden for owner and current user */}
                      {!isCurrentUser && !memberIsOwner && (
                        <button
                          onClick={() => {
                            setMemberToDelete(member);
                            setShowDeleteConfirmDialog(true);
                          }}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-full transition-all duration-200"
                          title="Delete member"
                        >
                          <FaTrashAlt className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <svg 
              className="mx-auto h-16 w-16 text-gray-400"
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth="1.5" 
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <p className="mt-4 text-lg font-medium text-gray-900">
              {translate('noTeamMembers')}
            </p>
            <p className="mt-1 text-gray-500">
              {translate('addTeamMembersToGetStarted')}
            </p>
          </div>
        )}
      </div>

      {/* Replace the Pending Invites Table section with this: */}
      <div className="bg-white p-6 rounded-lg shadow-md mt-6">
        <h3 className="text-2xl font-semibold text-gray-800 mb-4">
          {translate('pendingInvites')} ({pendingInvites.length})
        </h3>
        {loading ? (
          <p>{translate('loading')}</p>
        ) : pendingInvites.length > 0 ? (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full table-auto">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-4 text-left">{translate('email')}</th>
                    <th className="p-4 text-left">{translate('invitedAt')}</th>
                    <th className="p-4 text-left">{translate('permissions')}</th>
                    <th className="p-4 text-center">{translate('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingInvites.map((invite) => (
                    <tr key={invite.token} className="border-t hover:bg-gray-50">
                      <td className="p-4">{invite.email}</td>
                      <td className="p-4">
                        {new Date(invite.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-2">
                          {invite.permissions?.map((permId) => {
                            const permission = permissionsList.find(p => p.id === permId);
                            return permission ? (
                              <span
                                key={permId}
                                className="inline-block bg-gray-100 rounded-full px-3 py-1 text-sm font-semibold text-gray-700"
                              >
                                {permission.permission}
                              </span>
                            ) : null;
                          })}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-center items-center space-x-3">
                          <button
                            onClick={() => {
                              setInviteToDelete(invite);
                              setShowDeleteInviteDialog(true);
                            }}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-full transition-all duration-200"
                            title={translate('deleteInvite')}
                          >
                            <FaTrashAlt className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {pendingInvites.map((invite) => (
                <div key={invite.token} className={cardStyles.base}>
                  <div className={cardStyles.content}>
                    <div>
                      <p className={cardStyles.label}>{translate('email')}</p>
                      <p className={cardStyles.value}>{invite.email}</p>
                    </div>
                    
                    <div>
                      <p className={cardStyles.label}>{translate('invitedAt')}</p>
                      <p className={cardStyles.value}>
                        {new Date(invite.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div>
                      <p className={cardStyles.label}>{translate('permissions')}</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {invite.permissions?.map((permId) => {
                          const permission = permissionsList.find(p => p.id === permId);
                          return permission ? (
                            <span
                              key={permId}
                              className="inline-block bg-gray-100 rounded-full px-3 py-1 text-sm font-semibold text-gray-700"
                            >
                              {permission.permission}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                  </div>

                  <div className={cardStyles.actions}>
                    <button
                      onClick={() => {
                        setInviteToDelete(invite);
                        setShowDeleteInviteDialog(true);
                      }}
                      className="p-2 text-red-600 hover:bg-red-100 rounded-full transition-all duration-200"
                      title={translate('deleteInvite')}
                    >
                      <FaTrashAlt className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <svg 
              className="mx-auto h-16 w-16 text-gray-400"
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth="1.5" 
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <p className="mt-4 text-lg font-medium text-gray-900">
              {translate('noPendingInvites')}
            </p>
            <p className="mt-1 text-gray-500">
              {translate('inviteMembersToCollaborate')}
            </p>
          </div>
        )}
      </div>

      {/* Add Delete Invite Confirmation Dialog */}
      {showDeleteInviteDialog && (
        <div className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-md max-w-md w-full">
            <h3 className="text-2xl font-semibold text-gray-800 mb-4">
              {translate('confirmDeleteInvite')}
            </h3>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => {
                  setShowDeleteInviteDialog(false);
                  setInviteToDelete(null);
                }}
                className="px-4 py-2 bg-gray-400 text-white rounded-md hover:bg-gray-500 transition-colors"
              >
                {translate('cancel')}
              </button>
              <button
                onClick={handleDeleteInvite}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
              >
                {translate('delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Update Dialog */}
      {showPermissionsDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">
              {translate('editPermissions')} {editingMemberPermissions?.Users?.first_name}
            </h3>

            <div className="grid grid-cols-1 gap-3 mb-6">
              {permissionsList.map((permission) => (
                <label
                  key={permission.id}
                  className="flex items-center space-x-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={editingMemberPermissions?.permissions?.includes(permission.id)}
                    onChange={() => handlePermissionsChange(permission.id)}
                    className="w-4 h-4 text-accent rounded border-gray-300 focus:ring-accent"
                  />
                  <span className="text-gray-700">{translate(permission.permission)}</span>
                </label>
              ))}
            </div>

            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowPermissionsDialog(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {translate('cancel')}
              </button>
              <button
                onClick={handleUpdatePermissions}
                disabled={isSaving}
                className={`px-4 py-2 ${isSaving ? 'bg-gray-400' : 'bg-accent hover:bg-accent/90'
                  } text-white rounded-lg transition-colors`}
              >
                {isSaving ? translate('saving') : translate('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirmDialog && (
        <div className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-md max-w-md w-full">
            <h3 className="text-2xl font-semibold text-gray-800 mb-4">{translate('deleteMemberConfirmation')}</h3>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowDeleteConfirmDialog(false)}
                className="px-4 py-2 bg-gray-400 text-white rounded-md"
              >
                {translate('cancel')}
              </button>
              <button
                onClick={handleRemoveMember}
                className="px-4 py-2 bg-red-500 text-white rounded-md"
              >
                {translate('delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Transfer Ownership Dialog */}
      {showTransferDialog && (
        <div className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-md max-w-md w-full">
            <h3 className="text-2xl font-semibold text-gray-800 mb-4">
              {translate('confirmTransferOwnership')}
            </h3>
            <p className="text-gray-600 mb-4">
              {translate('transferOwnershipWarning', {
                name: `${transferToMember?.Users?.first_name} ${transferToMember?.Users?.last_name}`
              })}
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => {
                  setShowTransferDialog(false);
                  setTransferToMember(null);
                }}
                className="px-4 py-2 bg-gray-400 text-white rounded-md hover:bg-gray-500 transition-colors"
              >
                {translate('cancel')}
              </button>
              <button
                onClick={handleTransferOwnership}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
              >
                {translate('transfer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Teams;