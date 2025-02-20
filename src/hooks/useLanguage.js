import { useState, useEffect } from 'react';
import { languages, defaultLanguage } from '../config/languages';

export const useLanguage = () => {
  const [currentLanguage, setCurrentLanguage] = useState(defaultLanguage);

  useEffect(() => {
    // Try to get language from localStorage, fallback to default
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

  return {
    currentLanguage,
    changeLanguage,
    languages
  };
}; 