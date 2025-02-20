import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';

// Initialize Stripe
const stripePromise = loadStripe('pk_test_51OYOeyIg0JmvmaJzNlwRU48fe9U7rL5lXoa3QgTpLqffhxd9hvm71soV7hIwtGwQjftvRb6QehPiLjEIofAzs3cK008ncJkUXA'); // Replace with your Stripe publishable key

// Custom Hook to manage Stripe Checkout session creation
export const useStripeCheckout = () => {
  const [error, setError] = useState(null);

  const handleCheckout = async (stripePriceId) => {
    try {
      console.log('Starting checkout with price ID:', stripePriceId); // Debug log

      const response = await fetch('https://stripe.swiftabook.com/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: stripePriceId
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const { url } = await response.json();
      
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      throw error; // Re-throw to handle in component
    }
  };
  
  

  return {
    error,
    handleCheckout,
  };
};
