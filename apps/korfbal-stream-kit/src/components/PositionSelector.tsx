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

interface Props {
  viewType: 'callsheet' | 'show-caller';
}

export const PositionSelector = ({ viewType }: Props) => {
  const { productionId } = useParams<{ productionId: string }>();
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

  return (
    <div className="bg-white dark:bg-gray-950 min-h-screen flex flex-col items-center justify-center p-8 transition-colors">
      {productionId && (
        <div className="mb-12 max-w-full min-w-0 flex justify-center">
          <MatchHeader productionId={Number(productionId)} size="medium" />
        </div>
      )}
      <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-12 tracking-tight">Kies je positie</h1>
      {positions.length === 0 && (
        <p className="text-gray-500 dark:text-gray-400 mb-8">Geen posities gevonden voor deze productie. Zorg dat er items met posities zijn aangemaakt.</p>
      )}
      {(positions.length > 0 || viewType === 'callsheet') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full max-w-6xl">
          {/* The Show Caller has no menu entry of its own: it is the first choice here */}
          {viewType === 'callsheet' && (
            <Link
              to={`/show-caller/${productionId}/all`}
              className="group relative overflow-hidden bg-red-600 hover:bg-red-700 p-8 rounded-2xl text-center transition-all border border-red-600 shadow-sm hover:shadow-xl hover:-translate-y-1"
            >
              <span className="relative z-10 block text-xl font-bold text-white">Show Caller</span>
              <span className="relative z-10 block text-sm text-white/80 mt-1">Alle items, met de bediening</span>
            </Link>
          )}
          {positions.map((pos) => (
            <Link
              key={pos.id}
              to={`/${viewType}/${productionId}/${toSlug(pos.name)}`}
              className="group relative overflow-hidden bg-white dark:bg-white/5 hover:bg-orange-500 dark:hover:bg-orange-600 p-8 rounded-2xl text-center transition-all border border-gray-200 dark:border-white/10 hover:border-orange-500 dark:hover:border-orange-600 shadow-sm hover:shadow-xl hover:-translate-y-1"
            >
              <span className="relative z-10 text-xl font-bold text-gray-900 dark:text-white group-hover:text-white transition-colors">
                {pos.name}
              </span>
              <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-orange-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}

          {/* All items: only the show caller has an all-positions view; the callsheet always shows one position */}
          {viewType === 'show-caller' && (
            <Link
              to={`/${viewType}/${productionId}/all`}
              className="group relative overflow-hidden bg-gray-100 dark:bg-white/5 hover:bg-blue-600 p-8 rounded-2xl text-center transition-all border border-gray-200 dark:border-white/10 hover:border-blue-600 shadow-sm hover:shadow-xl hover:-translate-y-1"
            >
              <span className="relative z-10 text-xl font-bold text-gray-600 dark:text-white group-hover:text-white transition-colors">
                Alle Items
              </span>
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-700 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
};
