import React from 'react';
import {useParams} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {createUrl, extractError} from '../lib/api';
import {InterviewNames, splitInterviewPlaceholders} from '../lib/interviewPlaceholders';

// undefined = no provider: texts are shown as typed (placeholders included)
const InterviewNamesContext = React.createContext<InterviewNames | null | undefined>(undefined);

export function useInterviewNames(productionId: number | undefined) {
  return useQuery({
    // Under ['production', id, 'interviews'], so saving the interview selection refreshes it
    queryKey: ['production', productionId, 'interviews', 'names'],
    enabled: !!productionId,
    queryFn: async (): Promise<InterviewNames> => {
      const res = await fetch(createUrl(`/api/production/${productionId}/interview-names`));
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    // The selection can change on another device during the show
    refetchInterval: 10_000,
  });
}

/** Fills {coach-uit}-style placeholders in the callsheet with the interview selection of the production in the URL. */
export function InterviewNamesProvider({children}: { children: React.ReactNode }) {
  const {productionId} = useParams<{ productionId: string }>();
  const names = useInterviewNames(productionId ? Number(productionId) : undefined);
  return <InterviewNamesContext.Provider value={names.data ?? null}>{children}</InterviewNamesContext.Provider>;
}

/** A callsheet text with the interview names filled in; a label like "coach uit" (dimmed) while nobody is chosen. */
export function InterviewText({text}: { text: string }) {
  const names = React.useContext(InterviewNamesContext);
  const segments = names === undefined ? [] : splitInterviewPlaceholders(text, names);
  if (!segments.some((s) => s.resolved !== null)) return <>{text}</>;
  return (
    <>
      {segments.map((segment, i) =>
        segment.resolved === false
          ? <span key={i} className="opacity-60">{segment.text}</span>
          : <React.Fragment key={i}>{segment.text}</React.Fragment>
      )}
    </>
  );
}
