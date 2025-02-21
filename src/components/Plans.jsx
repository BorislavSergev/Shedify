import React, { useState, useEffect, useMemo, useContext } from 'react';
import supabase from '../hooks/supabase'; // Your Supabase hook
import { useStripeCheckout } from '../hooks/stripe'; // Use custom Stripe checkout hook
import { useLanguage } from '../hooks/useLanguage'; // Import useLanguage hook
import { LanguageContext } from '../contexts/LanguageContext'; // Adjust the path as necessary

const Plans = () => {
  const { translate } = useLanguage(); // Ensure this retrieves translate correctly
  const [plans, setPlans] = useState([]);
  const [currentPlanId, setCurrentPlanId] = useState(null);
  const [stripeCustomerId, setStripeCustomerId] = useState(null);
  const [loading, setLoading] = useState(true);
  const { handleCheckout } = useStripeCheckout(); // Stripe checkout function
  const [isLoadingButton, setIsLoadingButton] = useState(false); // New state for button loading

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
  }, [selectedBusiness.id]);

  // Add this useEffect to re-fetch translations when language changes
  useEffect(() => {
    // Re-fetch plans or any other necessary data when language changes
    const fetchPlans = async () => {
      try {
        const { data, error } = await supabase.from('Plans').select('*');
        if (error) throw error;
        setPlans(data);
      } catch (err) {
        console.error('Failed to fetch plans:', err);
      }
    };

    fetchPlans();
  }, [translate]); // Dependency on translate to trigger when language changes

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
    setIsLoadingButton(true); // Set loading state to true
    try {
      if (stripeCustomerId) {
        await goToCustomerPortal();
      } else {
        const selectedPlan = plans.find(plan => plan.id === planId);
        if (!selectedPlan) {
          throw new Error('Selected plan not found');
        }

        localStorage.setItem('subscription', JSON.stringify({
          id: selectedPlan.id,
          name: selectedPlan.plan_name,
          price: selectedPlan.price,
          stripePriceId: selectedPlan.stripe_price_id
        }));

        const button = document.querySelector(`button[data-plan-id="${planId}"]`);
        if (button) button.disabled = true;

        await new Promise(resolve => setTimeout(resolve, 100));
        await handleCheckout(stripePriceId);
      }
    } catch (error) {
      console.error('Plan selection failed:', error);
      alert(error.message || 'Failed to process payment. Please try again.');
    } finally {
      const button = document.querySelector(`button[data-plan-id="${planId}"]`);
      if (button) button.disabled = false;
      setIsLoadingButton(false); // Reset loading state
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center p-6"><p className="text-lg">{translate("loading")}</p></div>;
  }
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 bg-gradient-to-b from-gray-50 to-white">
      <div className="text-center mb-8 sm:mb-12">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 mb-4">
          {translate("choosePlan")}
        </h1>
        <p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-2xl mx-auto px-4 mb-4">
          {translate("choosePlanDescription")}
        </p>
      </div>

      {stripeCustomerId && (
        <div className="text-center mb-6 sm:mb-8">
          <button
            onClick={goToCustomerPortal}
            className="w-full sm:w-auto px-6 sm:px-8 py-3 bg-accent text-white font-semibold rounded-full shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
          >
            {translate("manageSubscription")}
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
                        {translate("currentPlan")}
                      </span>
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">{plan.plan_name}</h2>
                    <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">{plan.description}</p>
                    <div className="space-y-2 sm:space-y-3 mb-6 sm:mb-8">
                      <div className="flex items-center text-gray-700">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-accent mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                        </svg>
                        <span className="text-sm sm:text-base">{translate("teamSize")}: {plan.team_size}</span>
                      </div>
                      <div className="flex items-center text-gray-700">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-accent mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                        </svg>
                        <span className="text-sm sm:text-base">{translate("maxServices")}: {plan.max_services}</span>
                      </div>
                      <div className="flex items-center text-gray-700">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-accent mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                        </svg>
                        <span className="text-sm sm:text-base">{translate("maxOffers")}: {plan.max_offers}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-6">
                      {plan.price} лв.<span className="text-base sm:text-lg text-gray-500">/{translate("perMonth")}</span>
                    </p>
                    <button
                      data-plan-id={plan.id}
                      onClick={() => handlePlanSelect(plan.id, plan.stripe_price_id)}
                      className={`w-full py-2 sm:py-3 px-4 sm:px-6 rounded-full text-sm sm:text-base transition-all duration-300 ${
                        isCurrentPlan || loading || isLoadingButton // Disable if loading or current plan
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-accent text-white hover:bg-accent/90 transform hover:-translate-y-1 hover:shadow-lg'
                      }`}
                      disabled={isCurrentPlan || loading || isLoadingButton} // Disable button if loading
                    >
                      {isLoadingButton ? (
                        <span className="flex items-center justify-center">
                          <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12c0-4.418 3.582-8 8-8s8 3.582 8 8-3.582 8-8 8-8-3.582-8-8z"></path>
                          </svg>
                          {translate("processing")}
                        </span>
                      ) : isCurrentPlan ? (
                        translate("currentPlan")
                      ) : (
                        translate("choosePlan")
                      )}
                    </button>
                  </div>
                </div>
              );
            })
        ) : (
          <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-8 sm:py-12">
            <p className="text-lg sm:text-xl text-gray-500">{translate("noPlansAvailable")}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Plans;
