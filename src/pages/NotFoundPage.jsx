import React from 'react';
import { Link } from 'react-router-dom'; // To navigate back to the home page
import { motion } from 'framer-motion';

const NotFoundPage = () => {
  // Scroll Animation for fade-in effect
  const fadeIn = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.5 } },
  };

  return (
    <div className="bg-black text-white font-sans min-h-screen flex justify-center items-center">
      <motion.div
        className="text-center px-6 py-10 bg-gray-800 rounded-lg shadow-lg"
        variants={fadeIn}
        initial="hidden"
        animate="visible"
      >
        <motion.h1
          className="text-6xl font-bold mb-4"
          variants={fadeIn}
          initial="hidden"
          animate="visible"
        >
          404
        </motion.h1>
        <motion.p
          className="text-xl mb-6"
          variants={fadeIn}
          initial="hidden"
          animate="visible"
        >
          Oops! The page you're looking for cannot be found.
        </motion.p>
        <motion.p
          className="text-lg mb-6"
          variants={fadeIn}
          initial="hidden"
          animate="visible"
        >
          It seems like the page you are looking for does not exist or has been moved.
        </motion.p>
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
        >
          <Link
            to="/"
            className="bg-accent text-white px-6 py-3 rounded-full hover:bg-accent-dark transition"
          >
            Go Back Home
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default NotFoundPage;
