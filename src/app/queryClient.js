import { QueryClient } from '@tanstack/react-query';

function shouldRetry(failureCount, error) {
  if (failureCount >= 1) return false;
  if (error?.status >= 400 && error?.status < 500) return false;
  return true;
}

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: {
        retry: false,
      },
      queries: {
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: shouldRetry,
        staleTime: 30 * 1000,
      },
    },
  });
}
