import {MdDarkMode, MdLightMode} from 'react-icons/md';
import {useTheme} from '../theme/ThemeProvider';

/** Switches light/dark mode; the label and icon say what you switch to. */
export default function ThemeToggle({className = 'inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}: { className?: string }) {
  const {theme, toggle} = useTheme();
  const Icon = theme === 'dark' ? MdLightMode : MdDarkMode;
  return (
    <button type="button" onClick={toggle} className={className}>
      <Icon/><span>{theme === 'dark' ? 'Lichte modus' : 'Donkere modus'}</span>
    </button>
  );
}
