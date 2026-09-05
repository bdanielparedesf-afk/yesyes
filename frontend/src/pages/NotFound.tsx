import { Link } from 'react-router-dom';
import { Home, SearchX } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center space-y-6">
        <div className="w-24 h-24 bg-primary-50 rounded-full flex items-center justify-center mx-auto">
          <SearchX className="w-12 h-12 text-primary-500" />
        </div>
        <div>
          <h1 className="text-6xl font-extrabold text-gray-900">404</h1>
          <h2 className="text-2xl font-bold text-gray-800 mt-2">Página no encontrada</h2>
          <p className="mt-3 text-gray-600">
            La página que buscas no existe o fue movida. No te preocupes, puedes volver al inicio y seguir comprando.
          </p>
        </div>
        <Link
          to="/"
          className="inline-flex items-center px-8 py-3 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl shadow-lg shadow-primary-500/30 transition-all"
        >
          <Home className="w-5 h-5 mr-2" />
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
