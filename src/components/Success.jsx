import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import supabase from '../hooks/supabase'; // Import supabase directly
import { useLanguage } from '../contexts/LanguageContext'; // Import useLanguage
import { translations } from '../translations/translations'; // Add this import

const Success = () => {
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);
  const [showPlanName, setPlanName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0); // Add retry mechanism
  const navigate = useNavigate();
  const location = useLocation();
  const { currentLanguage } = useLanguage();
  const maxRetries = 3;

  const selectedBusiness = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("selectedBusiness")) || {};
    } catch (error) {
      console.error("Invalid business data in local storage", error);
      return {};
    }
  }, []);

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const sessionId = queryParams.get('session_id');

    if (sessionId) {
      fetchSessionData(sessionId);
    } else {
      setError(translations[currentLanguage].noSessionId);
      setLoading(false);
    }
  }, [location, retryCount]); // Add retryCount to dependencies

  const fetchSessionData = async (sessionId) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`https://stripe.swiftabook.com/api/checkout-session/${sessionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Add retry mechanism with exponential backoff
        retryOn: [503, 504],
        retries: 3,
        retryDelay: (retryCount) => Math.pow(2, retryCount) * 1000,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setSubscriptionInfo(data);
      
      const subscription = localStorage.getItem("subscription");
      const parsedSubscription = subscription ? JSON.parse(subscription) : null;
      setPlanName(parsedSubscription);

      if (parsedSubscription && selectedBusiness.id) {
        if (data.customer) {
          await updateBusinessPlan(parsedSubscription.id, data.customer);
        } else {
          throw new Error(translations[currentLanguage].missingCustomerInfo);
        }
      } else {
        throw new Error(translations[currentLanguage].noPlanOrBusiness);
      }
    } catch (err) {
      console.error('Error fetching session:', err);
      if (retryCount < maxRetries) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
        }, Math.pow(2, retryCount) * 1000); // Exponential backoff
      } else {
        setError(translations[currentLanguage].errorLoadingSubscription);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setRetryCount(0); // Reset retry count
    setError(null);
    const sessionId = new URLSearchParams(location.search).get('session_id');
    if (sessionId) {
      fetchSessionData(sessionId);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent mx-auto"></div>
          <p className="text-lg text-gray-600">{translations[currentLanguage].processingPayment}</p>
          <p className="text-sm text-gray-500">{translations[currentLanguage].pleaseWait}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8 space-y-6">
        {error ? (
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{translations[currentLanguage].error}</h1>
            <p className="text-gray-600">{error}</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-6">
              <button
                onClick={handleRetry}
                className="px-6 py-3 bg-accent text-white font-semibold rounded-full shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
              >
                {translations[currentLanguage].tryAgain}
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-full shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
              >
                {translations[currentLanguage].backToDashboard}
              </button>
            </div>
          </div>
        ) : subscriptionInfo ? (
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-gray-900">{translations[currentLanguage].subscriptionSuccessful}</h1>
              <p className="text-gray-600">{translations[currentLanguage].thankYouForSubscribing}</p>
            </div>
            
            <div className="bg-gray-50 p-6 rounded-xl space-y-4">
              <h2 className="text-xl font-semibold text-gray-800">{translations[currentLanguage].subscriptionInformation}</h2>
              <div className="space-y-3 divide-y divide-gray-200">
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">{translations[currentLanguage].plan}</span>
                  <span className="font-medium text-gray-900">{showPlanName?.name}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">{translations[currentLanguage].price}</span>
                  <span className="font-medium text-gray-900">
                    {subscriptionInfo.amount_total / 100} {subscriptionInfo.currency.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">{translations[currentLanguage].status}</span>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    {translations[currentLanguage][subscriptionInfo.payment_status] || subscriptionInfo.payment_status}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full px-6 py-3 bg-accent text-white font-semibold rounded-full shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
            >
              {translations[currentLanguage].backToDashboard}
            </button>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <p className="text-gray-600">{translations[currentLanguage].noSubscriptionInformation}</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 bg-accent text-white font-semibold rounded-full shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
            >
              {translations[currentLanguage].backToDashboard}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Success;
