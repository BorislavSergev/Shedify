import React, { useState, useEffect, useMemo } from 'react';
import supabase from '../hooks/supabase'; // Your Supabase hook
import { useStripeCheckout } from '../hooks/stripe'; // Use custom Stripe checkout hook

const Plans = () => {
  const [plans, setPlans] = useState([]);
  const [currentPlanId, setCurrentPlanId] = useState(null); // Track the current plan for the business
  const [stripeCustomerId, setStripeCustomerId] = useState(null); // Track the stripe_customer_id
  const [loading, setLoading] = useState(true);
  const { handleCheckout } = useStripeCheckout(); // Stripe checkout function

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
      const response = await fetch('http://localhost:4242/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ customerId: stripeCustomerId }), // Pass stripe_customer_id
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
    if (stripeCustomerId) {
      // Redirect to Customer Portal if the user already has a subscription
      await goToCustomerPortal();
    } else {
      // Proceed to checkout for a new subscription
      await handleCheckout(stripePriceId);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center p-6"><p className="text-lg">Loading plans...</p></div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-4xl font-bold text-accent mb-6">Subscription Plans</h1>

      {/* Conditionally render the Manage Subscription button */}
      {stripeCustomerId && (
        <button
          onClick={goToCustomerPortal}
          className="px-5 py-2 mb-6 bg-accent text-white font-semibold rounded-lg shadow-lg hover:scale-105 transition-transform"
        >
          Manage subscription
        </button>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
        {plans.length > 0 ? (
          plans
            .sort((a, b) => a.id - b.id) // Sort plans by ID in ascending order
            .map((plan) => {
              const isCurrentPlan = plan.id === currentPlanId;

              return (
                <div
                  key={plan.id}
                  className={`bg-white shadow-lg rounded-lg overflow-hidden p-6 flex flex-col justify-between border-2 ${
                    isCurrentPlan ? 'border-accent' : 'border-transparent'
                  }`}
                >
                  <h2 className="text-2xl font-semibold text-gray-800 mb-2">{plan.plan_name}</h2>
                  <p className="text-gray-600 mb-2">{plan.description}</p>
                  <p className="text-gray-600 mb-2">Team Size: {plan.team_size}</p>
                  <p className="text-gray-600 mb-2">Max Services: {plan.max_services}</p>
                  <p className="text-gray-600 mb-4">Max Offers: {plan.max_offers}</p>
                  <p className="text-xl font-bold text-gray-900 mb-6">Price: ${plan.price}</p>

                  <button
                    onClick={() => handlePlanSelect(plan.id, plan.stripe_price_id)}
                    className={`mt-auto py-2 px-4 rounded-md transition-all transform duration-300 ease-in-out ${
                      isCurrentPlan
                        ? 'bg-accent text-white border-accent cursor-not-allowed shadow-lg'
                        : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105'
                    }`}
                    disabled={isCurrentPlan}
                  >
                    {isCurrentPlan ? 'Current Plan' : `Subscribe for $${plan.price}`}
                  </button>
                </div>
              );
            })
        ) : (
          <p className="text-center text-gray-500">No plans available.</p>
        )}
      </div>
    </div>
  );
};

export default Plans;
