import {useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import {useProductions} from '../hooks/useProductions';

interface Props {
  viewType: 'standard' | 'show-caller';
}

export default function LiveCallsheetEntry({ viewType }: Props) {
  const navigate = useNavigate();
  const { data, isLoading, error } = useProductions();

  useEffect(() => {
    if (isLoading) return;
    if (error) return;

    const active = data?.items.find(p => p.isActive);
    if (active) {
      if (viewType === 'show-caller') {
        // Show Caller view gaat direct naar alle items (geen specifieke positie-slug nodig)
        navigate(`/live/${active.id}/show-caller/all`, { replace: true });
      } else {
        navigate(`/live/${active.id}/positions/${viewType}`, { replace: true });
      }
    }
  }, [data, isLoading, error, navigate, viewType]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-800 dark:text-gray-100">
        Actieve productie laden…
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-600">
        Fout bij laden: {String((error as any)?.message || error)}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center text-gray-800 dark:text-gray-100">
      Geen actieve productie gevonden. Ga naar /admin/productions om er een te activeren.
    </div>
  );
}
