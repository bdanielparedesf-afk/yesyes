import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Si se entrega, este error NO tumba la app: se muestra aqui. */
  fallback?: ReactNode;
  onError?: (error: Error) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  reloadRequested: boolean;
}

/**
 * Un chunk dinamico que no se puede cargar casi siempre es un despliegue nuevo:
 * el HTML cacheado pide `IndustryTemplates-BZdoGP9b.js` y ese hash ya no
 * existe. Reintentar el import vuelve a fallar igual, asi que en ese caso lo
 * unico que funciona es recargar la pagina para pedir el HTML vigente.
 */
export function isChunkLoadError(error: unknown): boolean {
  const message = String((error as Error)?.message || error || '');
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk \d+ failed/i.test(message);
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, reloadRequested: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, reloadRequested: false };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.props.onError?.(error);
    // Un solo reintento automatico: si el chunk ya no existe, recargar resuelve.
    if (isChunkLoadError(error) && !this.state.reloadRequested) {
      this.setState({ reloadRequested: true });
    }
  }

  handleReset = () => {
    if (isChunkLoadError(this.state.error)) {
      // Evitar el loop infinito si el deploy esta roto de verdad.
      this.forceUpdate(() => window.location.reload());
      return;
    }
    this.setState({ hasError: false, error: null });
  };

  handleHardReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Con `fallback` el error se acota a este bloque: el resto de la pantalla
      // (y en particular el asistente de creacion) sigue funcionando.
      if (this.props.fallback) return this.props.fallback;
      const chunkError = isChunkLoadError(this.state.error);
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-3xl">⚠️</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Algo salió mal</h1>
              <p className="mt-2 text-gray-600 text-sm">
                {chunkError
                  ? 'La página se actualizó y quedó una versión anterior guardada en tu navegador. Recarga para cargar la versión nueva.'
                  : this.state.error?.message || 'Ha ocurrido un error inesperado en la aplicación.'}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={chunkError ? this.handleHardReload : this.handleReset}
                className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl shadow-lg shadow-primary-500/30 transition-all"
              >
                {chunkError ? 'Recargar' : 'Reintentar'}
              </button>
              <a
                href="/"
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-xl transition-all inline-block"
              >
                Volver al inicio
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
