import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enLobby from './locales/en.json';
import deLobby from './locales/de.json';
import frLobby from './locales/fr.json';
import esLobby from './locales/es.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: enLobby,
      de: deLobby,
      fr: frLobby,
      es: esLobby,
    },
    ns: ['lobby', 'game', 'escape'],
    defaultNS: 'lobby',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already safes from xss
    },
  });

export default i18n;
