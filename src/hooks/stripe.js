import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';

// Initialize Stripe
const stripePromise = loadStripe('pk_test_51OYOeyIg0JmvmaJzNlwRU48fe9U7rL5lXoa3QgTpLqffhxd9hvm71soV7hIwtGwQjftvRb6QehPiLjEIofAzs3cK008ncJkUXA'); // Replace with your Stripe publishable key

// Custom Hook to manage Stripe Checkout session creation
export const useStripeCheckout = () => {
  const [error, setError] = useState(null);

  const handleCheckout = async (priceId) => {
    console.log('Price ID:', priceId); // Log to see the actual value
    try {
      const res = await fetch('http://localhost:4242/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ planId: priceId }), // Ensure the correct plan ID is sent
      });
  
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('Session creation failed: No URL in response');
      }
    } catch (error) {
      console.error('Failed to create checkout session:', error);  // Log the error
    }
  };
  
  

  return {
    error,
    handleCheckout,
  };
};
