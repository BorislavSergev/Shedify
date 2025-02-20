import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import axios from 'axios';

// Initialize Stripe
const stripePromise = loadStripe('pk_test_51OYOeyIg0JmvmaJzNlwRU48fe9U7rL5lXoa3QgTpLqffhxd9hvm71soV7hIwtGwQjftvRb6QehPiLjEIofAzs3cK008ncJkUXA');

// Get the API URL from environment variable or use development URL
const API_URL =  'https://stripe.swiftabook.com'; // Production server

export const useStripeCheckout = () => {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleCheckout = async (stripePriceId) => {
    setLoading(true);
    setError(null);

    try {
      console.log('Starting checkout with price ID:', stripePriceId);

      const selectedBusiness = JSON.parse(localStorage.getItem('selectedBusiness'));
      
      if (!selectedBusiness?.id) {
        throw new Error('No business selected');
      }

      // Create checkout session
      const response = await axios({
        method: 'POST',
        url: `${API_URL}/create-checkout-session`,
        data: { 
          planId: stripePriceId,
          businessId: selectedBusiness.id
        },
        headers: {
          'Content-Type': 'application/json',
          'Accept': '*/*'
        },
        withCredentials: true // Include cookies if needed
      });

      console.log('Checkout session created:', response.data);

      if (!response.data?.url) {
        throw new Error('No checkout URL received');
      }

      // Redirect to Stripe Checkout
      window.location.href = response.data.url;
    } catch (err) {
      console.error('Checkout error:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      
      let errorMessage = 'Failed to start checkout';
      
      if (!navigator.onLine) {
        errorMessage = 'Please check your internet connection';
      } else if (err.response?.status === 403) {
        errorMessage = 'Access denied. Please try again later.';
      } else if (err.response?.status === 500) {
        errorMessage = 'Server error. Please try again later.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    error,
    loading,
    handleCheckout,
  };
};
