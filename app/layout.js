'use client';

import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '../config/wagmi';
import './globals.css'; // <--- THIS IS THE MAGIC LINE

const queryClient = new QueryClient();

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <title>MasoMind Enterprise Suite</title>
        <meta name="description" content="An autonomous, multi-modal DeAI agent providing on-chain smart contract auditing and high-fidelity media rendering." />
        
        {/* TalentApp Domain Verification */}
        <meta name="talentapp:project_verification" content="314dd619318b8bb6a10287be8e102ca5fa1f59e9e73883dbad3858c484cb80b4796bd5b131b875a9c8bddd365a7d973a978a5a2b5817f41a8339b26e8d70bb8c" />
      </head>
      <body className="bg-zinc-950 text-zinc-100 min-h-screen selection:bg-emerald-500/30">
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </WagmiProvider>
      </body>
    </html>
  );
}
