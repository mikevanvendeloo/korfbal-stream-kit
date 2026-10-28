import {Link} from 'react-router-dom';
import {MdBusiness, MdSwapHoriz} from 'react-icons/md';
import {useCurrentOrganization} from './OrganizationGate';
import OrganizationLogo from './OrganizationLogo';
import {NavDropdown, navMenuItemClass} from './NavDropdown';
import {adminPaths} from '../lib/adminPaths';

/** The two choices for the chosen organization: its settings (in Beheer) and switching to another one. */
export function OrganizationMenuItems({itemClassName = navMenuItemClass}: { itemClassName?: string }) {
  const {organization, switchOrganization} = useCurrentOrganization();
  if (!organization) return null;
  return (
    <>
      <li><Link to={adminPaths.organization} className={itemClassName}><MdBusiness/><span>Organisatie-instellingen</span></Link></li>
      <li>
        <button type="button" onClick={switchOrganization} aria-label={`Wissel organisatie (nu ${organization.name})`}
                className={`${itemClassName} w-full text-left`}>
          <MdSwapHoriz/><span>Wissel organisatie</span>
        </button>
      </li>
    </>
  );
}

/** The chosen organization in a nav (LIVE and Beheer): logo and name, opening OrganizationMenuItems. */
export function OrganizationMenu({open, onToggle}: { open: boolean; onToggle: (open: boolean) => void }) {
  const {organization} = useCurrentOrganization();
  if (!organization) return null;
  return (
    <NavDropdown open={open} onToggle={onToggle} label={`Organisatiemenu (nu ${organization.name})`} className="min-w-0 max-w-48"
                 summaryClassName="list-none cursor-pointer inline-flex items-center gap-2 min-w-0 max-w-full rounded-full border border-gray-200 dark:border-gray-700 pl-1 pr-3 py-0.5 text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                 summary={<><OrganizationLogo organization={organization} size="small"/><span className="truncate">{organization.name}</span></>}>
      <OrganizationMenuItems/>
    </NavDropdown>
  );
}
