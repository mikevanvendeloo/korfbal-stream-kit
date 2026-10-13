import {useTheme} from '../theme/ThemeProvider';

export default function ThemeToggle() {
  const {theme, toggle} = useTheme();
  return (
    <button onClick={toggle}
            className="text-sm px-3 py-1 rounded-md border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800">
      {theme === 'dark' ? 'Light' : 'Dark'} mode
    </button>
  );
}
