// src/hooks/useLanguage.js
import { useState, useEffect } from 'react';
import { languages, defaultLanguage } from '../config/languages';
import { translations } from '../translations/translations'; // Ensure this is imported

export const useLanguage = () => {
  const [currentLanguage, setCurrentLanguage] = useState(defaultLanguage);

  useEffect(() => {
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage && languages[savedLanguage]) {
      setCurrentLanguage(savedLanguage);
    }
  }, []);

  const changeLanguage = (language) => {
    if (languages[language]) {
      setCurrentLanguage(language);
      localStorage.setItem('language', language);
    }
  };

  const translate = (key) => {
    const translation = translations[currentLanguage][key];
    return translation || key; // Fallback to key if translation is not found
  };

  return {
    currentLanguage,
    changeLanguage,
    translate, // Ensure translate is returned
    languages
  };
};