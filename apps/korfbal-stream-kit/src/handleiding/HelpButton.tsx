import {Link, useLocation} from 'react-router-dom';
import {MdHelpOutline} from 'react-icons/md';
import {helpTopicFor, manualPath} from './helpTopics';

/** Opens the manual at the chapter about the current screen. */
export default function HelpButton() {
  const {pathname} = useLocation();
  // On the manual itself, the button leads to its start
  const to = /^(\/admin)?\/handleiding/.test(pathname)
    ? pathname.replace(/^((?:\/admin)?\/handleiding).*$/, '$1')
    : manualPath(helpTopicFor(pathname));
  return (
    <Link to={to} title="Handleiding bij dit scherm" aria-label="Handleiding bij dit scherm"
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
      <MdHelpOutline className="w-5 h-5"/>
    </Link>
  );
}
