import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import supabase from '../hooks/supabase'; // Import supabase directly

const Success = () => {
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);
  const [showPlanName, setPlanName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const selectedBusiness = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("selectedBusiness")) || {};
    } catch (error) {
      console.error("Invalid business data in local storage", error);
      return {};
    }
  }, []);

  useEffect(() => {
    // Extract session_id from the URL query parameters
    const queryParams = new URLSearchParams(location.search);
    const sessionId = queryParams.get('session_id');

    if (sessionId) {
      // Make the request to the backend to fetch session details
      fetchSessionData(sessionId);
    }
  }, [location]);

  const fetchSessionData = async (sessionId) => {
    try {
      // Fetch session data from the backend
      const response = await fetch(`http://localhost:4242/api/checkout-session/${sessionId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch session data');
      }

      const data = await response.json();
      setSubscriptionInfo(data); // Store fetched subscription info
      setLoading(false);
      console.log(data);

      // Fetch and parse the subscription plan from localStorage
      const subscription = localStorage.getItem("subscription");
      const parsedSubscription = subscription ? JSON.parse(subscription) : null;
      setPlanName(parsedSubscription);

      if (parsedSubscription && selectedBusiness.id) {
        // Ensure `data.customer` exists before calling updateBusinessPlan
        if (data.customer) {
          updateBusinessPlan(parsedSubscription.id, data.customer); // Pass plan ID and customer ID
        } else {
          throw new Error('Customer information is missing in subscription data');
        }
      } else {
        setError('No plan or business selected');
        setLoading(false);
      }
    } catch (err) {
      console.error('Error fetching session:', err);
      setError('Failed to load subscription details');
      setLoading(false);
    }
  };

  const updateBusinessPlan = async (planId, customerId) => {
    try {
      // Get the current user's ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Update the business plan in the "Business" table
      const { data, error } = await supabase
        .from('Business')
        .update({ planId, visibility: true, stripe_customer_id: customerId }) // Update planId and set visibility to true
        .eq('id', selectedBusiness.id); // Assuming you want to update the selected business

      if (error) {
        throw new Error('Failed to update business plan');
      }

      console.log('Business plan updated successfully:', data);
    } catch (err) {
      console.error('Error updating business plan:', err);
      setError('Failed to update business plan');
    }
  };

  const handleGoBackToDashboard = () => {
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
        <p className="text-lg text-gray-600">Loading subscription details...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <div className="max-w-lg w-full bg-white rounded-lg shadow-lg p-8 space-y-6">
        <h1 className="text-3xl font-bold text-center text-green-600">Subscription Successful!</h1>

        {error ? (
          <p className="text-center text-red-500">{error}</p>
        ) : subscriptionInfo ? (
          <>
            <div className="bg-green-50 p-6 rounded-lg shadow-md">
              <h2 className="text-2xl font-semibold text-gray-800">Subscription Information</h2>
              <div className="mt-4 space-y-2">
                <p className="text-gray-700">
                  <strong>Plan:</strong> {showPlanName?.name}
                </p>
                <p className="text-gray-700">
                  <strong>Price:</strong> {subscriptionInfo.amount_total / 100} {subscriptionInfo.currency.toUpperCase()}
                </p>
                <p className="text-gray-700">
                  <strong>Status:</strong> <span className="text-green-500">{subscriptionInfo.payment_status}</span>
                </p>
              </div>
            </div>

            <div className="text-center mt-6">
              <button
                onClick={handleGoBackToDashboard}
                className="bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700 focus:outline-none transition-all"
              >
                Go Back to Dashboard
              </button>
            </div>
          </>
        ) : (
          <p className="text-center text-gray-500">No subscription information available.</p>
        )}
      </div>
    </div>
  );
};

export default Success;
