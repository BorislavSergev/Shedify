import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import supabase from "./hooks/supabase"; // Import the Supabase client
import BusinessLayout from "./layouts/BusinessLayout";
import DefaultLayout from "./layouts/DefaultLayout";
import Dashboard from "./components/Dashboard";
import Settings from "./components/Settings";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Teams from "./components/Teams";
import Offers from "./components/Offers";
import CreateBusiness from "./pages/CreateBusiness";
import Reservations from "./components/Reservations";
import Services from "./components/Services";
import Home from "./pages/Home";
import Plans from "./components/Plans";
import VerifyEmail from "./pages/VerifyEmail"; // Create this page for email verification
import Success from "./components/Success";
import BusinessPage from "./pages/BusinessPage";
import ReservationPage from "./pages/ReservationPage";
import MyProfile from "./components/MyProfile";
import NotFoundPage from "./pages/NotFoundPage";
import PageCustomizer from "./components/PageCustomizer";
import Default from "./pages/themes/default/default";
import ManageReservation from "./pages/ManageReservation";
import { LanguageProvider } from './contexts/LanguageContext';
import { ToastProvider } from './contexts/ToastContext';

const App = () => {
  const [user, setUser] = useState(null); // Track user state
  const [loading, setLoading] = useState(true); // To handle loading state
  const [session, setSession] = useState(null);

  // Initial auth setup
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Prevent page reload on tab focus
    const handleVisibilityChange = () => {
      // Do nothing when visibility changes
      return;
    };

    // Add visibility change listener
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Add this to prevent React's default behavior with strict mode
  useEffect(() => {
    // Disable the browser's default reload behavior
    window.onpageshow = (event) => {
      if (event.persisted) {
        // Prevent reload on back/forward navigation
        event.preventDefault();
      }
    };
  }, []);

  // Protected route component
  const ProtectedRoute = ({ element }) => {
    if (loading) return <div>Loading...</div>;

    if (!user) {
      return <Navigate to="/login" replace />;
    }

    if (!user.email_confirmed_at) {
      return <Navigate to="/verify-email" replace />;
    }

    return element;
  };

  // Public route component - redirects if user is already logged in
  const PublicRoute = ({ element }) => {
    if (loading) return <div>Loading...</div>;

    // Check if it's a team invite registration
    const params = new URLSearchParams(window.location.search);
    const isTeamInvite = params.get('token') && params.get('business');

    // Allow access to register page if it's a team invite, even if user is logged in
    if (isTeamInvite && element.type === Register) {
      return element;
    }

    // For other public routes, redirect to dashboard if user is logged in
    if (user && user.email_confirmed_at) {
      return <Navigate to="/dashboard" replace />;
    }

    return element;
  };

  return (
    <ToastProvider>
      <LanguageProvider>
        <Router>
          <Routes>
            {/* BusinessLayout Routes (with Sidebar) */}
            <Route element={<BusinessLayout />}>
              {/* Protected route, only accessible if user is authenticated and email is verified */}
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute 
                    element={
                      <Dashboard 
                        onInviteAccept={async (token, businessId) => {
                          try {
                            // Get invite details
                            const { data: inviteData, error: inviteError } = await supabase
                              .from("businessteaminvites")
                              .select("*")
                              .eq("token", token)
                              .eq("businessid", businessId)
                              .single();

                            if (inviteError) throw inviteError;

                            // Add user to BusinessTeam
                            const { data: businessTeamData, error: teamError } = await supabase
                              .from("BusinessTeam")
                              .insert([{
                                businessId: businessId,
                                userId: user.id,
                                worktime: null,
                                bufferTime: null
                              }])
                              .select()
                              .single();

                            if (teamError) throw teamError;

                            // Add permissions
                            if (inviteData.permissions?.length > 0) {
                              const permissionsToAdd = inviteData.permissions.map(permissionId => ({
                                businessTeamId: businessTeamData.id,
                                permissionId: permissionId
                              }));

                              const { error: permissionsError } = await supabase
                                .from("BusinessTeam_Permissions")
                                .insert(permissionsToAdd);

                              if (permissionsError) throw permissionsError;
                            }

                            // Delete the used invite
                            await supabase
                              .from("businessteaminvites")
                              .delete()
                              .eq("token", token);

                            // Refresh the page or update state as needed
                            window.location.reload();
                          } catch (error) {
                            console.error("Error accepting invite:", error);
                            alert("Failed to accept invitation. Please try again.");
                          }
                        }}
                      />
                    }
                  />
                }
              />
              <Route path="/dashboard/settings" element={<ProtectedRoute element={<Settings />} />} />
              <Route path="/dashboard/team" element={<ProtectedRoute element={<Teams />} />} />
              <Route path="/dashboard/services" element={<ProtectedRoute element={<Services />} />} />
              <Route path="/dashboard/reservations" element={<ProtectedRoute element={<Reservations />} />} />
              <Route path="/dashboard/offers" element={<ProtectedRoute element={<Offers />} />} />
              <Route path="/dashboard/subscription" element={<ProtectedRoute element={<Plans />} />} />
              <Route path="/dashboard/profile" element={<ProtectedRoute element={<MyProfile />} />} />
              <Route path="/dashboard/customize" element={<ProtectedRoute element={<PageCustomizer />} />} />
            </Route>

            {/* DefaultLayout Routes (no Sidebar) */}
            <Route element={<DefaultLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/test" element={<Default />} />
              <Route path="*" element={<NotFoundPage />} />

              {/* Public routes with potential redirects */}
              <Route path="/login" element={<PublicRoute element={<Login />} />} />
              <Route path="/register" element={<PublicRoute element={<Register />} />} />
              
              {/* Business and reservation routes */}
              <Route path="/:id" element={<BusinessPage />} />
              <Route path="/:businessId/reservation" element={<ReservationPage />} />
              <Route path="/manage/reservation/:id" element={<ManageReservation />} />

              {/* Protected routes that require authentication */}
              <Route path="/create-business" element={<ProtectedRoute element={<CreateBusiness />} />} />
              <Route path="/success" element={<ProtectedRoute element={<Success />} />} />

              {/* Verify email route - only accessible when user exists but email isn't verified */}
              <Route
                path="/verify-email"
                element={
                  loading ? (
                    <div>Loading...</div>
                  ) : user && !user.email_confirmed_at ? (
                    <VerifyEmail />
                  ) : (
                    <Navigate to="/dashboard" replace />
                  )
                }
              />
            </Route>
          </Routes>
        </Router>
      </LanguageProvider>
    </ToastProvider>
  );
};

export default App;
