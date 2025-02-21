import React, { createContext, useState, useContext, useEffect } from 'react';
import { translations } from '../translations/translations';
import { defaultLanguage } from '../config/languages';

// Create the LanguageContext
const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('language') || defaultLanguage;
  });

  const translate = (key) => {
    return translations[language][key] || translations[defaultLanguage][key] || key;
  };

  const changeLanguage = (newLanguage) => {
    setLanguage(newLanguage);
    localStorage.setItem('language', newLanguage);
  };

  return (
    <LanguageContext.Provider value={{ language, translate, changeLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

// Export the LanguageContext and the useLanguage hook
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export { LanguageContext }; // Ensure LanguageContext is exported 