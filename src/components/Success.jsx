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

  // Enhanced translation helper with better fallback handling
  const t = (key) => {
    // Default to English if currentLanguage is not available
    const lang = currentLanguage || 'bg';
    
    // First try the current language
    if (translations[lang]?.[key]) {
      return translations[lang][key];
    }
    
    // Fallback to English
    if (translations.en?.[key]) {
      return translations.en[key];
    }
    
    // If all else fails, return the key itself
    console.warn(`Missing translation for key: ${key}`);
    return key;
  };

  const selectedBusiness = useMemo(() => {
    try {
      const business = localStorage.getItem('selectedBusiness');
      return business ? JSON.parse(business) : null;
    } catch (error) {
      console.error('Invalid business data in local storage', error);
      return null;
    }
  }, []);

  const updateBusinessPlan = async (planId, stripeCustomerId) => {
    try {
      const { error: updateError } = await supabase
        .from('Business')
        .update({
          planId: planId,
          stripe_customer_id: stripeCustomerId,
        })
        .eq('id', selectedBusiness.id);

      if (updateError) throw updateError;
    } catch (err) {
      console.error('Error updating business plan:', err);
      throw new Error(t('errorUpdatingPlan'));
    }
  };

  const fetchSessionData = async (sessionId) => {
    try {
      setLoading(true);
      setError(null);

      // Validate business selection first
      if (!selectedBusiness?.id) {
        throw new Error(t('noPlanOrBusiness'));
      }

      const response = await fetch(`https://stripe.swiftabook.com/api/checkout-session/${sessionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`${t('httpError')}: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message || t('errorProcessingPayment'));
      }

      setSubscriptionInfo(data);
      
      const subscription = localStorage.getItem('subscription');
      const parsedSubscription = subscription ? JSON.parse(subscription) : null;
      setPlanName(parsedSubscription);

      if (!parsedSubscription) {
        throw new Error(t('noSubscriptionData'));
      }

      if (data.customer) {
        await updateBusinessPlan(parsedSubscription.id, data.customer);
      } else {
        throw new Error(t('missingCustomerInfo'));
      }

    } catch (err) {
      console.error('Error fetching session:', err);
      if (retryCount < maxRetries) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
        }, retryDelay * Math.pow(2, retryCount));
      } else {
        setError(err.message || t('errorLoadingSubscription'));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const sessionId = queryParams.get('session_id');

    if (!sessionId) {
      setError(t('noSessionId'));
      setLoading(false);
      return;
    }

    fetchSessionData(sessionId);
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
          <p className="text-lg text-gray-600">{t('processingPayment')}</p>
          <p className="text-sm text-gray-500">{t('pleaseWait')}</p>
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
            <h1 className="text-2xl font-bold text-gray-900">{t('error')}</h1>
            <p className="text-gray-600">{error}</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-6">
              <button
                onClick={handleRetry}
                className="px-6 py-3 bg-accent text-white font-semibold rounded-full shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
              >
                {t('tryAgain')}
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-full shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
              >
                {t('backToDashboard')}
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
              <h1 className="text-3xl font-bold text-gray-900">{t('subscriptionSuccessful')}</h1>
              <p className="text-gray-600">{t('thankYouForSubscribing')}</p>
            </div>
            
            <div className="bg-gray-50 p-6 rounded-xl space-y-4">
              <h2 className="text-xl font-semibold text-gray-800">{t('subscriptionInformation')}</h2>
              <div className="space-y-3 divide-y divide-gray-200">
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">{t('plan')}</span>
                  <span className="font-medium text-gray-900">{showPlanName?.name}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">{t('price')}</span>
                  <span className="font-medium text-gray-900">
                    {subscriptionInfo.amount_total / 100} {subscriptionInfo.currency.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">{t('customerEmail')}</span>
                  <span className="font-medium text-gray-900">
                    {subscriptionInfo.customer_details?.email}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">{t('status')}</span>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    {t(subscriptionInfo.payment_status)}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full px-6 py-3 bg-accent text-white font-semibold rounded-full shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
            >
              {t('backToDashboard')}
            </button>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <p className="text-gray-600">{t('noSubscriptionInformation')}</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 bg-accent text-white font-semibold rounded-full shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
            >
              {t('backToDashboard')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Success;
