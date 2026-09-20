import { QueryClient, QueryClientProvider, HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { ReactNode } from 'react';

/**
 * QueryClient configurado para la tienda YesYes.
 *
 * - staleTime: 30s → los datos son "frescos" 30s; pasado ese tiempo se refetch
 *   en background manteniendo los datos anteriores a la vista (sin pantallas blancas).
 * - gcTime: 5 min → los datos permanecen en caché 5 minutos tras inactividad,
 *   lo que permite que al volver atrás la información aparezca al instante.
 * - refetchOnWindowFocus: true → al volver a la pestaña se refrescan precios/stock.
 * - refetchOnReconnect: true → al restablecerse la red se refetch.
 * - retry: 1 → un solo reintento en caso de error transitorio.
 *
 * La coherencia de stock/precio se mantiene: los datos stale se refetch en
 * background y el UI se actualiza cuando llegan los nuevos valores.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 300_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true,
      retry: 1,
      retryDelay: 1_000,
      // Evita que el scroll se pierda al refetch de background.
      // El contenido anterior se mantiene visible hasta que el nuevo llega.
    },
  },
});

interface QueryProviderProps {
  children: ReactNode;
}

/**
 * Proveedor de React Query. Envuelve la aplicación para habilitar
 * caching, background refetch y estados de carga optimizados.
 */
export default function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

// Re-exportamos utilidades para uso en SSR/hydration si fuera necesario
export { HydrationBoundary, dehydrate };
export { queryClient };
