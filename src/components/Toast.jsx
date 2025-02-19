import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCheckCircle, FaExclamationCircle, FaInfoCircle } from 'react-icons/fa';

const Toast = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000); // Auto dismiss after 3 seconds

    return () => clearTimeout(timer);
  }, [onClose]);

  const icons = {
    success: <FaCheckCircle className="w-5 h-5 text-green-500" />,
    error: <FaExclamationCircle className="w-5 h-5 text-red-500" />,
    info: <FaInfoCircle className="w-5 h-5 text-blue-500" />
  };

  const bgColors = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    info: 'bg-blue-50 border-blue-200'
  };

  const textColors = {
    success: 'text-green-800',
    error: 'text-red-800',
    info: 'text-blue-800'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, x: '100%' }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, y: 50, x: '100%' }}
      className={`fixed bottom-4 right-4 z-50 p-4 rounded-lg shadow-lg border ${bgColors[type]} max-w-md`}
    >
      <div className="flex items-center space-x-3">
        {icons[type]}
        <p className={`${textColors[type]} font-medium`}>{message}</p>
      </div>
    </motion.div>
  );
};

export default Toast; 