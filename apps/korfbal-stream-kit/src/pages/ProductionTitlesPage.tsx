import {Link, useParams} from 'react-router-dom';
import TitlesManager from '../components/TitlesManager';
import {adminPaths} from '../lib/adminPaths';

export default function ProductionTitlesPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return (
      <div className="container py-6 text-gray-800 dark:text-gray-100">
        <div>Ongeldige productie id</div>
        <Link to={adminPaths.productions} className="mt-3 inline-block px-3 py-1 border rounded">Terug</Link>
      </div>
    );
  }
  return (
    <div className="container py-6 text-gray-800 dark:text-gray-100">
      <h1 className="text-lg font-semibold mb-3">vMix titels</h1>
      <TitlesManager productionId={id} />
    </div>
  );
}
