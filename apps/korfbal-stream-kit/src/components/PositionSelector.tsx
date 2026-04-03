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
    return <div className="text-white text-center p-10">Posities laden...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-center p-10">Fout: {error}</div>;
  }

  const baseViewUrl = viewType === 'show-caller' ? 'show-caller' : 'view';

  return (
    <div className="bg-gray-800 min-h-screen flex flex-col items-center justify-center p-8">
      {productionId && (
        <div className="mb-12">
          <MatchHeader productionId={Number(productionId)} size="medium" />
        </div>
      )}
      <h1 className="text-4xl font-bold text-white mb-8">Kies je positie</h1>
      {positions.length === 0 ? (
        <p className="text-gray-400">Geen posities gevonden voor deze productie. Zorg dat er events met posities zijn aangemaakt.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {positions.map((pos) => (
            <Link
              key={pos.id}
              to={`/live/${productionId}/${baseViewUrl}/${toSlug(pos.name)}`}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-6 px-8 rounded-lg text-center transition-transform transform hover:scale-105"
            >
              {pos.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
