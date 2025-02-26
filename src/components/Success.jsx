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

  const updateBusinessPlan = async (planId, stripeCustomerId, subscriptionId) => {
    try {
      const { error: updateError } = await supabase
        .from('Business')
        .update({
          planId: planId,
          stripe_customer_id: stripeCustomerId,
          visibility: true,
          membership_expiry: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString()
        })
        .eq('id', selectedBusiness.id);

      if (updateError) {
        console.error('Error updating business:', updateError);
        throw new Error(t('errorUpdatingBusiness'));
      }


    } catch (err) {
      console.error('Error in updateBusinessPlan:', err);
      throw new Error(t('errorUpdatingPlan'));
    }
  };

  const formatAmount = (amount, currency) => {
    const formatter = new Intl.NumberFormat('bg-BG', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
    });
    return formatter.format(amount / 100);
  };

  const fetchSessionData = async (sessionId) => {
    try {
      setLoading(true);
      setError(null);

      const subscription = localStorage.getItem('subscription');
      const parsedSubscription = subscription ? JSON.parse(subscription) : null;
      
      if (!parsedSubscription) {
        console.error('Missing subscription data:', { subscription, parsedSubscription });
        navigate('/dashboard');
        return;
      }

      if (!selectedBusiness?.id) {
        navigate('/businesses');
        return;
      }

      // Implement retry logic with exponential backoff
      let lastError;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            // Wait with exponential backoff before retrying
            await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt - 1)));
          }

          const response = await fetch(`https://stripe.shedify.eu/api/checkout-session/${sessionId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            // Add timeout to prevent hanging requests
            signal: AbortSignal.timeout(10000), // 10 second timeout
          });

          if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
          }

          const data = await response.json();
          
          if (data.error) {
            throw new Error(data.error.message || t('errorProcessingPayment'));
          }

          // Rest of the success logic
          setSubscriptionInfo(data);
          setPlanName(parsedSubscription);

          if (data.customer && data.subscription) {
            await updateBusinessPlan(
              parsedSubscription.id, 
              data.customer,
              data.subscription
            );
            localStorage.removeItem('subscription');
            return; // Success - exit the retry loop
          } else {
            throw new Error(t('missingSubscriptionInfo'));
          }
        } catch (err) {
          lastError = err;
          console.error(`Attempt ${attempt + 1}/${maxRetries + 1} failed:`, err);
          if (attempt === maxRetries) {
            throw err; // Rethrow the last error if we're out of retries
          }
        }
      }
    } catch (err) {
      console.error('Error details:', {
        message: err.message,
        stack: err.stack,
        localStorage: {
          subscription: localStorage.getItem('subscription'),
          selectedBusiness: localStorage.getItem('selectedBusiness')
        }
      });
      setError(err.message || t('errorLoadingSubscription'));
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white p-4 sm:p-6">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-4 sm:p-8 space-y-6">
        {error ? (
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-12 sm:w-16 h-12 sm:h-16 rounded-full bg-red-100 mb-4">
              <svg className="w-6 sm:w-8 h-6 sm:h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{t('error')}</h1>
            <p className="text-sm sm:text-base text-gray-600">{error}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
              <button
                onClick={handleRetry}
                className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 bg-accent text-white text-sm sm:text-base font-semibold rounded-full shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
              >
                {t('tryAgain')}
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 bg-gray-200 text-gray-700 text-sm sm:text-base font-semibold rounded-full shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
              >
                {t('backToDashboard')}
              </button>
            </div>
          </div>
        ) : subscriptionInfo ? (
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-12 sm:w-16 h-12 sm:h-16 rounded-full bg-green-100 mb-4">
              <svg className="w-6 sm:w-8 h-6 sm:h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <div className="space-y-2">
              <h1 className="text-xl sm:text-3xl font-bold text-gray-900">{t('subscriptionSuccessful')}</h1>
              <p className="text-sm sm:text-base text-gray-600">{t('thankYouForSubscribing')}</p>
            </div>
            
            <div className="bg-gray-50 p-4 sm:p-6 rounded-xl space-y-4">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800">{t('subscriptionInformation')}</h2>
              <div className="space-y-3 divide-y divide-gray-200 text-sm sm:text-base">
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">{t('plan')}</span>
                  <span className="font-medium text-gray-900">{showPlanName?.name}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">{t('price')}</span>
                  <span className="font-medium text-gray-900">
                    {formatAmount(subscriptionInfo.amount_total, subscriptionInfo.currency)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">{t('customerName')}</span>
                  <span className="font-medium text-gray-900 break-all">
                    {subscriptionInfo.customer_details?.name}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">{t('email')}</span>
                  <span className="font-medium text-gray-900 break-all">
                    {subscriptionInfo.customer_details?.email}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">{t('status')}</span>
                  <span className="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-green-100 text-green-800">
                    {t(subscriptionInfo.payment_status)}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full px-4 sm:px-6 py-2 sm:py-3 bg-accent text-white text-sm sm:text-base font-semibold rounded-full shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
            >
              {t('backToDashboard')}
            </button>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <p className="text-sm sm:text-base text-gray-600">{t('noSubscriptionInformation')}</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 bg-accent text-white text-sm sm:text-base font-semibold rounded-full shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
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
