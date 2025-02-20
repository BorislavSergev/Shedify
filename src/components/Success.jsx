import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import supabase from '../hooks/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../translations/translations';

const Success = () => {
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);
  const [showPlanName, setPlanName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const { currentLanguage } = useLanguage();
  const maxRetries = 3;
  const retryDelay = 2000; // 2 seconds

  const selectedBusiness = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('selectedBusiness')) || {};
    } catch (error) {
      console.error('Invalid business data in local storage', error);
      return {};
    }
  }, []);

  const updateBusinessPlan = async (planId, stripeCustomerId) => {
    try {
      const { error: updateError } = await supabase
        .from('Business')
        .update({
          planId: planId,
          stripe_customer_id: stripeCustomerId,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedBusiness.id);

      if (updateError) throw updateError;
    } catch (err) {
      console.error('Error updating business plan:', err);
      throw new Error(translations[currentLanguage].errorUpdatingPlan);
    }
  };

  const fetchSessionData = async (sessionId) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`https://stripe.swiftabook.com/api/checkout-session/${sessionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important for CORS
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message || translations[currentLanguage].errorProcessingPayment);
      }

      setSubscriptionInfo(data);
      
      const subscription = localStorage.getItem('subscription');
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
        }, retryDelay * Math.pow(2, retryCount)); // Exponential backoff
      } else {
        setError(err.message || translations[currentLanguage].errorLoadingSubscription);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const sessionId = queryParams.get('session_id');

    if (sessionId) {
      fetchSessionData(sessionId);
    } else {
      setError(translations[currentLanguage].noSessionId);
      setLoading(false);
    }
  }, [location, retryCount]);

  const handleRetry = () => {
    setRetryCount(0);
    setError(null);
    const sessionId = new URLSearchParams(location.search).get('session_id');
    if (sessionId) {
      fetchSessionData(sessionId);
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
