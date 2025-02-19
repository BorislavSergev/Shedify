// api/checkout-session.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); // Server-side secret key

exports.handler = async (event) => {
  try {
    // Parse the incoming JSON payload from the frontend
    const { priceId, successUrl, cancelUrl } = JSON.parse(event.body);

    // Create Checkout Session from the frontend data
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,  // The Price ID from Stripe
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    // Send back the session ID to frontend
    return {
      statusCode: 200,
      body: JSON.stringify({ id: session.id }),
    };
  } catch (error) {
    // Return an error if something goes wrong
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
    