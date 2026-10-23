import React from 'react';
import {useParams} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {createUrl, extractError} from '../lib/api';
import {InterviewNames, InterviewPerson, PlaceholderSegment, splitInterviewPlaceholders} from '../lib/interviewPlaceholders';
import {useInterviewsUpdatedRefresh} from '../hooks/useInterviews';
import {useInterviewPhotos} from '../hooks/useInterviewPhotos';
import {InterviewAvatar} from './InterviewAvatar';

// undefined = no provider: texts are shown as typed (placeholders included)
const InterviewNamesContext = React.createContext<InterviewNames | null | undefined>(undefined);

export function useInterviewNames(productionId: number | undefined) {
  useInterviewsUpdatedRefresh(productionId);
  return useQuery({
    // Under ['production', id, 'interviews'], so saving the interview selection refreshes it
    queryKey: ['production', productionId, 'interviews', 'names'],
    enabled: !!productionId,
    queryFn: async (): Promise<InterviewNames> => {
      const res = await fetch(createUrl(`/api/production/${productionId}/interview-names`));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    // The selection can change on another device during the show (a socket event usually comes first)
    refetchInterval: 10_000,
  });
}

/** Fills {coach-uit}-style placeholders in the callsheet with the interview selection of the production in the URL. */
export function InterviewNamesProvider({children}: { children: React.ReactNode }) {
  const {productionId} = useParams<{ productionId: string }>();
  const names = useInterviewNames(productionId ? Number(productionId) : undefined);
  return <InterviewNamesContext.Provider value={names.data ?? null}>{children}</InterviewNamesContext.Provider>;
}

/** A fixed interview selection instead of the one of the production in the URL (component tests). */
export function StaticInterviewNames({names, children}: { names: InterviewNames | null; children: React.ReactNode }) {
  return <InterviewNamesContext.Provider value={names}>{children}</InterviewNamesContext.Provider>;
}

/** The chosen person a placeholder segment names, when there is one. */
export function personFor(segment: PlaceholderSegment, names: InterviewNames | null | undefined): InterviewPerson | null {
  if (segment.resolved !== true || !segment.side || !segment.role) return null;
  return names?.people?.[segment.side]?.[segment.role] ?? null;
}

type Props = {
  text: string;
  /** This place may show the photos (the setting "Interviewfoto's" decides too) */
  photos?: boolean;
};

/**
 * A callsheet text with the interview names filled in; a label like "coach uit" (dimmed) while nobody
 * is chosen. With `photos`, each filled-in name gets a small photo (or shirt number, or initials) in front.
 */
export function InterviewText({text, photos = false}: Props) {
  const names = React.useContext(InterviewNamesContext);
  const [photosOn] = useInterviewPhotos();
  const segments = names === undefined ? [] : splitInterviewPlaceholders(text, names);
  if (!segments.some((s) => s.resolved !== null)) return <>{text}</>;
  const withPhotos = photos && photosOn;
  return (
    <>
      {segments.map((segment, i) => {
        if (segment.resolved === false) return <span key={i} className="opacity-60">{segment.text}</span>;
        const person = withPhotos ? personFor(segment, names) : null;
        if (!person) return <React.Fragment key={i}>{segment.text}</React.Fragment>;
        const role = segment.role;
        const number = role !== 'COACH' && person.photoUrl && person.shirtNo != null && person.shirtNo > 0 ? person.shirtNo : null;
        // Inline (no flex), so a long name still wraps on a phone
        return (
          <span key={i} data-testid="interview-person">
            <InterviewAvatar person={person} role={role} className="mr-[0.3em]"/>
            {segment.text}
            {number != null && <span className="ml-[0.25em] text-[0.75em] font-bold opacity-70 tabular-nums">#{number}</span>}
          </span>
        );
      })}
    </>
  );
}
