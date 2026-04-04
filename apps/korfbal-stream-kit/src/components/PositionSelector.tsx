import {useEffect, useState} from 'react';
import {Link, useParams} from 'react-router-dom';
import {MatchHeader} from "./MatchHeader";

// Type dat overeenkomt met het Prisma 'Position' model
interface Position {
  id: number;
  name: string;
}

// Helper om een naam om te zetten naar een URL-vriendelijke slug
const toSlug = (name: string) => {
  return name.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');
};

export const PositionSelector = () => {
  const { productionId, viewType } = useParams<{ productionId: string, viewType: string }>();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPositions = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/production/${productionId}/events/positions`);
        if (!response.ok) {
          throw new Error('Kon de posities niet ophalen.');
        }
        const data: Position[] = await response.json();
        setPositions(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (productionId) {
      fetchPositions();
    }
  }, [productionId]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 min-h-screen flex items-center justify-center text-gray-900 dark:text-white transition-colors">
        Posities laden...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-900 min-h-screen flex items-center justify-center text-red-500 transition-colors">
        Fout: {error}
      </div>
    );
  }

  const baseViewUrl = viewType === 'show-caller' ? 'show-caller' : 'view';

  return (
    <div className="bg-white dark:bg-gray-950 min-h-screen flex flex-col items-center justify-center p-8 transition-colors">
      {productionId && (
        <div className="mb-12">
          <MatchHeader productionId={Number(productionId)} size="medium" />
        </div>
      )}
      <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-12 tracking-tight">Kies je positie</h1>
      {positions.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">Geen posities gevonden voor deze productie. Zorg dat er items met posities zijn aangemaakt.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full max-w-6xl">
          {positions.map((pos) => (
            <Link
              key={pos.id}
              to={`/live/${productionId}/${baseViewUrl}/${toSlug(pos.name)}`}
              className="group relative overflow-hidden bg-white dark:bg-white/5 hover:bg-orange-500 dark:hover:bg-orange-600 p-8 rounded-2xl text-center transition-all border border-gray-200 dark:border-white/10 hover:border-orange-500 dark:hover:border-orange-600 shadow-sm hover:shadow-xl hover:-translate-y-1"
            >
              <span className="relative z-10 text-xl font-bold text-gray-900 dark:text-white group-hover:text-white transition-colors">
                {pos.name}
              </span>
              <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-orange-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}

          {/* Special case: All items view (alleen voor show-caller of als overzicht) */}
          <Link
            to={`/live/${productionId}/${baseViewUrl}/all`}
            className="group relative overflow-hidden bg-gray-100 dark:bg-white/5 hover:bg-blue-600 p-8 rounded-2xl text-center transition-all border border-gray-200 dark:border-white/10 hover:border-blue-600 shadow-sm hover:shadow-xl hover:-translate-y-1"
          >
            <span className="relative z-10 text-xl font-bold text-gray-600 dark:text-white group-hover:text-white transition-colors">
              Alle Items
            </span>
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-700 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        </div>
      )}
    </div>
  );
};
