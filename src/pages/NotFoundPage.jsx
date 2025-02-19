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
    <div className="bg-primary text-txtPrimary font-sans min-h-screen flex justify-center items-center">
      <motion.div
        className="text-center px-8 py-12 bg-white rounded-2xl shadow-xl"
        variants={fadeIn}
        initial="hidden"
        animate="visible"
      >
        <motion.h1
          className="text-8xl font-bold mb-6 text-accent"
          variants={fadeIn}
          initial="hidden"
          animate="visible"
        >
          404
        </motion.h1>
        <motion.p
          className="text-2xl mb-6 text-txtPrimary font-medium"
          variants={fadeIn}
          initial="hidden"
          animate="visible"
        >
          Упс! Страницата, която търсите, не може да бъде намерена.
        </motion.p>
        <motion.p
          className="text-lg mb-8 text-secondary"
          variants={fadeIn}
          initial="hidden"
          animate="visible"
        >
          Изглежда, че страницата, която търсите, не съществува или е преместена.
        </motion.p>
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
        >
          <Link
            to="/"
            className="bg-accent text-white px-8 py-4 rounded-full hover:bg-accentHover transition-all duration-300 text-lg font-medium"
          >
            Към началната страница
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default NotFoundPage;
