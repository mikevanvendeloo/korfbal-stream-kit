import {createUrl} from '../lib/api';
import type {Organization} from '../hooks/useOrganizations';

type Size = 'small' | 'medium' | 'large';

const sizeClasses: Record<Size, string> = {
  small: 'w-7 h-7 text-xs',
  medium: 'w-12 h-12 text-base',
  large: 'w-20 h-20 text-2xl',
};

/** Own logo, else the linked club's, else the initials (design D1). */
export default function OrganizationLogo({organization, size = 'medium', className = ''}: {
  organization: Pick<Organization, 'name' | 'displayLogoUrl' | 'initials'>;
  size?: Size;
  className?: string;
}) {
  const sizeClass = sizeClasses[size];
  const logo = organization.displayLogoUrl;
  if (logo) {
    const src = logo.startsWith('http') ? logo : createUrl(`/storage/${logo}`).toString();
    // Decorative: the name always stands next to it
    return <img src={src} alt="" className={`${sizeClass} object-contain shrink-0 ${className}`}/>;
  }
  return (
    <span aria-hidden
          className={`${sizeClass} shrink-0 inline-flex items-center justify-center rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 font-semibold ${className}`}>
      {organization.initials}
    </span>
  );
}
