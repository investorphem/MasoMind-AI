'use client';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { celo } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Initialize a local fallback config for the admin sub-tree path
const config = createConfig({
  chains: [celo],
  connectors: [injected()],
  transports: {
    [celo.id]: http(),
  },
});

const queryClient = new Client ? new QueryClient() : new QueryClient();

export default function AdminLayout({ children }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
