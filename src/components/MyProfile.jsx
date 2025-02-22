import React, { useState, useEffect } from "react";
import supabase from "../hooks/supabase"; // Import Supabase client
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const MyProfile = () => {
  const { translate } = useLanguage();
  const [user, setUser] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Fetch user profile details from Users table on mount
  useEffect(() => {
    const fetchUserData = async () => {
      const { data: authUser, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) {
        setError(`Authentication error: ${authError?.message}`);
        return;
      }

      setUser(authUser);

      const { data: userProfile, error: userError } = await supabase
        .from("Users")
        .select("avatar, first_name, last_name, email")
        .eq("id", authUser.user.id)
        .single();

      if (userError) {
        setError(`Failed to fetch user profile: ${userError?.message}`);
        return;
      }

      setEmail(userProfile?.email || "");
      setFirstName(userProfile?.first_name || "");
      setLastName(userProfile?.last_name || "");
      setAvatarPreview(userProfile?.avatar || "");
    };

    fetchUserData();
  }, []);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("File is too large. Maximum size is 5MB.");
        return;
      }

      const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
      if (!allowedTypes.includes(file.type)) {
        setError("Only image files are allowed.");
        return;
      }

      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSaveChanges = async () => {
    if (isUpdating) return; // Prevent multiple clicks

    setIsUpdating(true);
    setError(""); // Clear previous errors

    try {
      const authUser = (await supabase.auth.getUser()).data;
      if (!authUser) {
        throw new Error("User not authenticated.");
      }

      let avatarUrl = avatarPreview;
      if (avatarFile) {
        const fileName = `${authUser.user.id}-avatar.${avatarFile.name.split('.').pop()}`;

        const { data, error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(fileName, avatarFile);

        if (uploadError) {
          throw new Error(`Failed to upload avatar: ${uploadError.message}`);
        }

        const { data: urlData, error: urlError } = supabase.storage
          .from("avatars")
          .getPublicUrl(fileName);

        if (urlError || !urlData) {
          throw new Error("Failed to retrieve public URL for the uploaded avatar.");
        }

        avatarUrl = urlData.publicUrl;
      }

      // Update the user's profile (avatar, first name, last name, email)
      const { error: updateProfileError } = await supabase
        .from("Users")
        .update({
          avatar: avatarUrl,
          first_name: firstName,
          last_name: lastName,
          email,
        })
        .eq("id", authUser.user.id);

      if (updateProfileError) {
        throw new Error(`Failed to update user profile: ${updateProfileError.message}`);
      }

      alert("Profile updated successfully!");
    } catch (err) {
      setError(err.message || "An error occurred while updating the profile.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleEmailUpdate = async (newEmail) => {
    try {
      setLoading(true);
      setError('');
      setMessage('');
      
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.auth.updateUser({
        email: newEmail
      });

      if (error) throw error;

      setMessage('Email update verification has been sent to your new email address. Please check your inbox.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        throw new Error('New passwords do not match');
      }

      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;

      setMessage('Password updated successfully');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setIsChangingPassword(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      setError('Please type DELETE to confirm account deletion');
      return;
    }

    try {
      setLoading(true);
      
      // First delete all businesses owned by the user
      const { error: businessError } = await supabase
        .from('Businesses')
        .delete()
        .eq('ownerId', user.id);

      if (businessError) throw businessError;

      // Delete the user's profile
      const { error: profileError } = await supabase
        .from('Users')
        .delete()
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Finally delete the auth user
      const { error: authError } = await supabase.auth.admin.deleteUser(user.id);
      
      if (authError) throw authError;

      // Sign out and redirect
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setIsDeleteModalOpen(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-8 border-b border-gray-200">
          <h1 className="text-3xl font-bold text-gray-900">{translate('myProfile')}</h1>
        </div>
        
        <div className="p-8 space-y-8">
          {/* Personal Information Section */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">{translate('avatar')}</label>
                {avatarPreview && (
                  <img
                    src={avatarPreview}
                    alt={translate('avatar')}
                    className="mt-2 w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                  />
                )}
                <div className="mt-2 relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                    id="avatar-upload"
                  />
                  <label
                    htmlFor="avatar-upload"
                    className="cursor-pointer inline-flex items-center px-4 py-2 text-sm font-medium text-accent bg-primary rounded-md hover:bg-accentHover hover:text-white"
                  >
                    {translate('chooseFile')}
                  </label>
                  <span className="ml-3 text-sm text-gray-500">
                    {avatarFile ? avatarFile.name : translate('noFileChosen')}
                  </span>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{translate('firstName')}</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{translate('lastName')}</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Password Change Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">{translate('security')}</h2>
            {!isChangingPassword ? (
              <button
                onClick={() => setIsChangingPassword(true)}
                className="px-4 py-2 text-sm font-medium text-accent bg-primary rounded-md hover:bg-accentHover hover:text-white"
              >
                {translate('changePassword')}
              </button>
            ) : (
              <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{translate('currentPassword')}</label>
                  <input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{translate('newPassword')}</label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{translate('confirmPassword')}</label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div className="flex space-x-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-white bg-accent rounded-md hover:bg-accentHover focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    {loading ? translate('updating') : translate('updatePassword')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsChangingPassword(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    {translate('cancel')}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Danger Zone */}
          <div className="mt-10 border-t border-red-200 pt-8">
            <h2 className="text-xl font-semibold text-red-600">{translate('dangerZone')}</h2>
            <p className="mt-2 text-sm text-gray-600">
              {translate('deleteAccountWarning')}
            </p>
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="mt-4 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              {translate('deleteAccount')}
            </button>
          </div>
        </div>
      </div>

      {/* Delete Account Modal */}
      <Transition appear show={isDeleteModalOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-10"
          onClose={() => setIsDeleteModalOpen(false)}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all border border-gray-300">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900"
                  >
                    {translate('deleteAccount')}
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      {translate('deleteAccountConfirmation')}
                    </p>
                    <p className="mt-2 text-sm text-gray-500">
                      {translate('typeDeleteToConfirm')}
                    </p>
                    <input
                      type="text"
                      value={deleteConfirmation}
                      placeholder="DELETE"
                      onChange={(e) => setDeleteConfirmation(e.target.value)}
                      className="mt-2 block w-full rounded-md bordera-accent shadow-sm focus:border-red-500 focus:ring-red-500 placeholder:text-red-500 placeholder:font-bold placeholder:text-sm placeholder:p-2 border border-gray-400 p-2"
                    />
                  </div>

                  <div className="mt-4 flex space-x-4">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                      onClick={handleDeleteAccount}
                    >
                      {translate('deleteAccount')}
                    </button>
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                      onClick={() => setIsDeleteModalOpen(false)}
                    >
                      {translate('cancel')}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Status Messages */}
      {message && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <p className="text-green-700">{message}</p>
        </div>
      )}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Save Changes Button */}
      <div className="flex justify-end mt-4">
        <button
          onClick={handleSaveChanges}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-accent rounded-md hover:bg-accentHover focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {loading ? translate('saving') : translate('saveChanges')}
        </button>
      </div>
    </div>
  );
};

export default MyProfile;
