// hooks/useStripeCheckout.js
import { useState } from 'react';
import axios from 'axios';
import { loadStripe } from '@stripe/stripe-js';

// Initialize Stripe with the publishable key from environment variable
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);  

export const useStripeCheckout = () => {
  const [error, setError] = useState(null);

  const handleCheckout = async (priceId) => {
    try {
      // Make a request to your backend to create a Stripe Checkout session
      const { data } = await axios.post(`${process.env.REACT_APP_API_URL}/create-checkout-session`, { priceId });

      // Check if sessionId was returned by backend
      if (data.sessionId) {
        // Redirect to Stripe Checkout using the session ID
        const stripe = await stripePromise;
        const { error } = await stripe.redirectToCheckout({ sessionId: data.sessionId });
        
        if (error) {
          setError(error.message); // Handle any error during checkout redirection
        }
      } else {
        setError('Failed to create checkout session: sessionId not received');
      }
    } catch (err) {
      setError('Failed to start checkout process: ' + err.message);
    }
  };

  return { handleCheckout, error };
};
