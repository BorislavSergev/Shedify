import React, { useState, useEffect, useMemo } from 'react';
import supabase from '../hooks/supabase'; // Your Supabase hook
import { useStripeCheckout } from '../hooks/stripe'; // Use custom Stripe checkout hook
import { translations } from '../translations/translations';
import { useLanguage } from '../hooks/useLanguage'; // You'll need to create this hook if you haven't already

const Plans = () => {
  const [plans, setPlans] = useState([]);
  const [currentPlanId, setCurrentPlanId] = useState(null); // Track the current plan for the business
  const [stripeCustomerId, setStripeCustomerId] = useState(null); // Track the stripe_customer_id
  const [loading, setLoading] = useState(true);
  const { handleCheckout } = useStripeCheckout(); // Stripe checkout function
  const { currentLanguage } = useLanguage();

  const selectedBusiness = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('selectedBusiness')) || {};
    } catch (error) {
      console.error('Invalid business data in local storage', error);
      return {};
    }
  }, []);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const { data, error } = await supabase.from('Plans').select('*');
        if (error) throw error;
        setPlans(data);
      } catch (err) {
        console.error('Failed to fetch plans:', err);
      }
    };

    const fetchCurrentPlan = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { data, error } = await supabase
          .from('Business')
          .select('planId, stripe_customer_id') // Fetch both planId and stripe_customer_id
          .eq('id', selectedBusiness.id)
          .single();
        if (error) throw error;

        setCurrentPlanId(data?.planId || null);
        setStripeCustomerId(data?.stripe_customer_id || null); // Set stripe_customer_id
      } catch (err) {
        console.error('Failed to fetch current plan:', err);
      }
    };

    const initialize = async () => {
      setLoading(true);
      await Promise.all([fetchPlans(), fetchCurrentPlan()]);
      setLoading(false);
    };

    initialize();
  }, []);

  const goToCustomerPortal = async () => {
    try {
      const response = await fetch('https://stripe.swiftabook.com/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ customerId: stripeCustomerId }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url; // Redirect to Customer Portal
      } else {
        console.error('Error redirecting to Customer Portal: Missing URL in response');
      }
    } catch (error) {
      console.error('Error redirecting to Customer Portal:', error);
    }
  };

  const handlePlanSelect = async (planId, stripePriceId) => {
    try {
      if (stripeCustomerId) {
        await goToCustomerPortal();
      } else {
        // Disable the button while loading
        const button = document.querySelector(`button[data-plan-id="${planId}"]`);
        if (button) button.disabled = true;
        
        await handleCheckout(stripePriceId);
      }
    } catch (error) {
      console.error('Plan selection failed:', error);
      // Show error to user (you might want to add a toast notification system)
      alert(error.message || 'Failed to process payment. Please try again.');
    } finally {
      // Re-enable the button
      const button = document.querySelector(`button[data-plan-id="${planId}"]`);
      if (button) button.disabled = false;
    }
  };

  // Add new function to handle test request
  

  if (loading) {
    return <div className="flex justify-center items-center p-6"><p className="text-lg">{translations[currentLanguage].loading}</p></div>;
  }
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 bg-gradient-to-b from-gray-50 to-white">
      <div className="text-center mb-8 sm:mb-12">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 mb-4">
          {translations[currentLanguage].choosePlan}
        </h1>
        <p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-2xl mx-auto px-4 mb-4">
          {translations[currentLanguage].choosePlanDescription}
        </p>
        
      </div>

      {stripeCustomerId && (
        <div className="text-center mb-6 sm:mb-8">
          <button
            onClick={goToCustomerPortal}
            className="w-full sm:w-auto px-6 sm:px-8 py-3 bg-accent text-white font-semibold rounded-full shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
          >
            {translations[currentLanguage].manageSubscription}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
        {plans.length > 0 ? (
          plans
            .sort((a, b) => a.id - b.id)
            .map((plan) => {
              const isCurrentPlan = plan.id === currentPlanId;

              return (
                <div
                  key={plan.id}
                  className={`relative bg-white rounded-2xl overflow-hidden p-6 sm:p-8 flex flex-col justify-between transform transition-all duration-300 hover:shadow-2xl ${
                    isCurrentPlan 
                      ? 'border-2 border-accent shadow-accent/20' 
                      : 'border border-gray-100 hover:-translate-y-2'
                  }`}
                >
                  {isCurrentPlan && (
                    <div className="absolute top-2 right-2 sm:top-4 sm:right-4">
                      <span className="bg-accent text-white text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-full">
                        {translations[currentLanguage].currentPlan}
                      </span>
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">{plan.plan_name}</h2>
                    <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">{plan.description}</p>
                    <div className="space-y-2 sm:space-y-3 mb-6 sm:mb-8">
                      <div className="flex items-center text-gray-700">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-accent mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                        </svg>
                        <span className="text-sm sm:text-base">{translations[currentLanguage].teamSize}: {plan.team_size}</span>
                      </div>
                      <div className="flex items-center text-gray-700">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-accent mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                        </svg>
                        <span className="text-sm sm:text-base">{translations[currentLanguage].maxServices}: {plan.max_services}</span>
                      </div>
                      <div className="flex items-center text-gray-700">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-accent mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                        </svg>
                        <span className="text-sm sm:text-base">{translations[currentLanguage].maxOffers}: {plan.max_offers}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-6">
                      {plan.price} лв.<span className="text-base sm:text-lg text-gray-500">/мес</span>
                    </p>
                    <button
                      data-plan-id={plan.id}
                      onClick={() => handlePlanSelect(plan.id, plan.stripe_price_id)}
                      className={`w-full py-2 sm:py-3 px-4 sm:px-6 rounded-full text-sm sm:text-base transition-all duration-300 ${
                        isCurrentPlan || loading
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-accent text-white hover:bg-accent/90 transform hover:-translate-y-1 hover:shadow-lg'
                      }`}
                      disabled={isCurrentPlan || loading}
                    >
                      {loading ? 'Processing...' : isCurrentPlan ? translations[currentLanguage].currentPlan : translations[currentLanguage].choosePlan}
                    </button>
                  </div>
                </div>
              );
            })
        ) : (
          <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-8 sm:py-12">
            <p className="text-lg sm:text-xl text-gray-500">{translations[currentLanguage].noPlansAvailable}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Plans;
