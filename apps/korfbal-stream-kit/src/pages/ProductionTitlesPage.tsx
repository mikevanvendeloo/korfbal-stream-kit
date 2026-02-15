import {Link, useParams} from 'react-router-dom';
import TitlesManager from '../components/TitlesManager';
import ProductionHeader from '../components/ProductionHeader';

export default function ProductionTitlesPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return (
      <div className="container py-6 text-gray-800 dark:text-gray-100">
        <div>Ongeldige productie id</div>
        <Link to="/admin/productions" className="mt-3 inline-block px-3 py-1 border rounded">Terug</Link>
      </div>
    );
  }
  return (
    <div className="container py-6 text-gray-800 dark:text-gray-100">
      <ProductionHeader productionId={id} />
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold">vMix titels</h1>
        <div className="flex items-center gap-2">
          <Link to={`/admin/productions/${id}`} className="px-3 py-1 border rounded">Terug naar productie</Link>
        </div>
      </div>
      <TitlesManager productionId={id} />
    </div>
  );
}
