import { useTranslation } from 'react-i18next';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <select
      value={i18n.resolvedLanguage || 'en'}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      className="text-xs px-2.5 py-2 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 font-medium transition-all outline-none"
    >
      <option value="en">English</option>
      <option value="de">Deutsch</option>
      <option value="fr">Français</option>
      <option value="es">Español</option>
    </select>
  );
}
