import React from 'react';
import { motion } from 'framer-motion';
import { FaGithub, FaTwitter, FaLinkedin, FaInstagram } from 'react-icons/fa';
import Navbar from '../components/Navbar';

const Home = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 1,
        staggerChildren: 0.3
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5
      }
    }
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[#edfcf3] text-gray-800 flex flex-col items-center justify-center p-4 pt-16">
        <motion.div
          className="max-w-4xl mx-auto text-center"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Logo or Brand */}
          <motion.div variants={itemVariants} className="mb-8">
            <h1 className="text-6xl font-bold bg-gradient-to-r from-[#1cd05e] to-[#40e87c] bg-clip-text text-transparent">
              Очаквайте скоро
            </h1>
          </motion.div>

          {/* Description */}
          <motion.p variants={itemVariants} className="text-xl text-gray-600 mb-12">
            Работим усилено, за да ви донесем нещо невероятно. Очаквайте!
          </motion.p>

          {/* Email Subscription */}
          <motion.div variants={itemVariants} className="mb-12">
            <form onSubmit={(e) => e.preventDefault()} className="flex flex-col sm:flex-row gap-4 justify-center">
              <input
                type="email"
                placeholder="Въведете вашия имейл"
                className="px-6 py-3 rounded-full bg-white border border-gray-200 focus:outline-none focus:border-[#1cd05e] text-gray-800 w-full sm:w-96"
              />
              <button
                type="submit"
                className="px-8 py-3 rounded-full bg-[#1cd05e] hover:bg-[#19b853] transition-colors duration-300 text-white font-semibold"
              >
                Уведоми ме
              </button>
            </form>
          </motion.div>

          {/* Social Links */}
          <motion.div variants={itemVariants} className="flex justify-center space-x-6">
            <a href="#" className="text-gray-500 hover:text-[#1cd05e] transition-colors duration-300">
              <FaGithub size={24} />
            </a>
            <a href="#" className="text-gray-500 hover:text-[#1cd05e] transition-colors duration-300">
              <FaTwitter size={24} />
            </a>
            <a href="#" className="text-gray-500 hover:text-[#1cd05e] transition-colors duration-300">
              <FaLinkedin size={24} />
            </a>
            <a href="#" className="text-gray-500 hover:text-[#1cd05e] transition-colors duration-300">
              <FaInstagram size={24} />
            </a>
          </motion.div>

          {/* Additional Info */}
          <motion.p variants={itemVariants} className="mt-12 text-gray-400">
            © 2025 Shedify. Всички права запазени.
          </motion.p>
        </motion.div>

        {/* Background Animation */}
        <motion.div
          className="absolute inset-0 -z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 2 }}
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-[#1cd05e]/10 to-transparent" />
        </motion.div>
      </div>
    </>
  );
};

export default Home;