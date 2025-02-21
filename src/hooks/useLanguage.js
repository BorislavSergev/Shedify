// src/hooks/useLanguage.js
import { createContext, useContext, useState, useEffect } from 'react';
import { languages, defaultLanguage } from '../config/languages';
import { translations } from '../translations/translations'; // Ensure this is imported

// Example translations
const translations = {
  en: {
    loading: "Loading...",
    choosePlan: "Choose a Plan",
    choosePlanDescription: "Select the plan that suits you best.",
    currentPlan: "Current Plan",
    teamSize: "Team Size",
    maxServices: "Max Services",
    // ... other translations
  },
  bg: {
    loading: "Зареждане...",
    choosePlan: "Изберете план",
    choosePlanDescription: "Изберете плана, който най-добре отговаря на вас.",
    currentPlan: "Текущ план",
    teamSize: "Размер на екипа",
    maxServices: "Макс. услуги",
    // ... other translations
  }
};

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState('en'); // Default language

  useEffect(() => {
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage && languages[savedLanguage]) {
      setLanguage(savedLanguage);
    }
  }, []);

  const changeLanguage = (language) => {
    if (languages[language]) {
      setLanguage(language);
      localStorage.setItem('language', language);
    }
  };

  const translate = (key) => {
    return translations[language][key] || key; // Fallback to key if translation not found
  };

  return (
    <LanguageContext.Provider value={{ translate, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);