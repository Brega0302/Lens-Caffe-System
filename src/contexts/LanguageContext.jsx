import React, { createContext, useContext, useState, useEffect } from 'react';
import { en } from '../i18n/en';
import { bs } from '../i18n/bs';

const dictionaries = { en, bs };

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('app_language') || 'en';
  });

  const changeLanguage = (lang) => {
    if (dictionaries[lang]) {
      setLanguage(lang);
      localStorage.setItem('app_language', lang);
    }
  };

  const t = (key) => {
    return dictionaries[language][key] || key;
  };

  const currencySymbol = language === 'en' ? 'BAM' : 'KM';

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t, currencySymbol }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
