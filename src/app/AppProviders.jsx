import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from 'react-hot-toast';

import { createAppQueryClient } from './queryClient';

export function AppProviders({ children }) {
  const [queryClient] = useState(createAppQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4500,
          style: {
            background: 'var(--app-color-text)',
            borderRadius: 'var(--app-radius-md)',
            color: 'var(--app-color-surface)',
          },
        }}
      />
    </QueryClientProvider>
  );
}
