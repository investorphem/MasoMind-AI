import { http, createConfig } from 'wagmi';
import { celo } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

// Get your free project ID from cloud.walletconnect.com
const PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_BACKUP_PROJECT_ID_HERE';

export const config = createConfig({
  chains: [celo],
  connectors: [
    injected(), // Handles extension wallets and embedded browser injection (like MiniPay)
    walletConnect({ projectId: PROJECT_ID }) // Triggers the unified QR code modal on standard web browsers
  ],
  transports: {
    [celo.id]: http('https://forno.celo.org'),
  },
});
