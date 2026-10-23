import {createUrl} from '../lib/api';
import {FallbackImage} from './FallbackImage';

export type AvatarPerson = { name: string; shirtNo: number | null; photoUrl: string | null };

/** "Jan de Vries" → "JV": first letter of the first and the last word. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}

/** The photo URL the kit uses for players (Player.photoUrl is relative to /uploads). */
export function playerPhotoUrl(photoUrl: string | null | undefined): string | null {
  return photoUrl ? createUrl(`/uploads/${photoUrl}`).toString() : null;
}

/** Coaches have no shirt number: they always get their initials. */
export function shownShirtNo(person: AvatarPerson, role?: 'PLAYER' | 'COACH'): number | null {
  return role === 'COACH' || person.shirtNo == null || person.shirtNo <= 0 ? null : person.shirtNo;
}

const SIZES = {
  // Next to a name in a callsheet text: grows with the font size of that text
  // (em counts from the avatar's own, smaller font: 2.2em here is about 1.5 times the surrounding text)
  inline: 'w-[2.2em] h-[2.2em] text-[0.7em] align-middle',
  card: 'w-24 h-24 sm:w-28 sm:h-28 text-4xl',
} as const;

type Props = {
  person: AvatarPerson;
  role?: 'PLAYER' | 'COACH';
  size?: keyof typeof SIZES;
  className?: string;
};

/**
 * A round photo of an interview person. Without a photo (or when it fails to load) the shirt number
 * is shown large in the circle; without a number (coaches) the initials.
 */
export function InterviewAvatar({person, role, size = 'inline', className = ''}: Props) {
  const shirtNo = shownShirtNo(person, role);
  const box = `${SIZES[size]} shrink-0 rounded-full overflow-hidden ${className}`;
  const fallback = shirtNo != null ? (
    <span role="img" aria-label={`${person.name}, rugnummer ${shirtNo}`}
          className={`${box} inline-flex items-center justify-center bg-blue-600 text-white font-black tabular-nums leading-none`}>
      {shirtNo}
    </span>
  ) : (
    <span role="img" aria-label={person.name}
          className={`${box} inline-flex items-center justify-center bg-gray-300 text-gray-800 dark:bg-gray-600 dark:text-white font-bold leading-none`}>
      {initials(person.name)}
    </span>
  );
  return (
    <FallbackImage
      src={playerPhotoUrl(person.photoUrl)}
      alt={`Foto van ${person.name}`}
      fallback={fallback}
      className={`${box} inline-block object-cover object-top bg-gray-200 dark:bg-gray-700`}
    />
  );
}
