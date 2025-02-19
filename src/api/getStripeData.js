import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      // Fetch products and prices from Stripe API
      const products = await stripe.products.list({ limit: 10 });
      const prices = await stripe.prices.list({
        product: products.data.map((product) => product.id),
      });

      res.status(200).json({ products: products.data, prices: prices.data });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch data from Stripe' });
    }
  } else {
    res.status(405).json({ error: 'Method Not Allowed' });
  }
}
