# MasoMind Enterprise Suite 🧠

MasoMind is a decentralized, multi-modal AI platform built for the Web3 ecosystem. It provides enterprise-grade AI tools—spanning from smart contract auditing to high-fidelity video generation—gated by a seamless, multi-token blockchain payment router on Celo.

Developed by **Masonode Technologies Limited**.

## 🚀 Overview

MasoMind bridges the gap between decentralized finance and state-of-the-art artificial intelligence. Users can execute prompts and generate media using stablecoins (cUSD, USDC, USDT) directly from their Web3 wallets (MetaMask, Valora, MiniPay) or via WalletConnect.

The platform features an ultra-secure, auto-recovering backend that verifies on-chain receipts before querying AI models, ensuring a trustless, hack-proof experience while permanently saving generated assets to a decentralized ledger.

## ⚡ The AI Engines (Mainnet Pricing)

MasoMind offers four distinct AI services, routed seamlessly through a single smart contract:

1. **Smart Contract Auditor (0.05 Stablecoins):** Powered by Gemini 2.5 Flash. Analyzes Solidity/Clarity code for vulnerabilities, reentrancy risks, and gas optimizations, returning a professional markdown report.
2. **AI Image Studio (0.10 Stablecoins):** Generates high-fidelity, untethered image assets based on natural language intents.
3. **AI Music Engine (0.50 Stablecoins):** Powered by Google Lyria 3. Generates complete 30-second, high-fidelity music tracks and soundscapes for GameFi and Web3 creators.
4. **AI Video Studio (1.00 Stablecoins):** Powered by Google Veo 3.1. Generates short, high-quality cinematic video clips with natively generated audio.

## ✨ Core Infrastructur

* **Omni-Token Payment Gateway:** Pay natively with Celo ecosystem stablecoins (`cUSD`, `USDC`, `USDT`).
* **Smart Allowance Auto-Routing:** The frontend handles token approvals and balance checks contextually.
* **The Vault (Replay-Attack Protection):** Powered by Supabase, the backend cryptographically locks transaction hashes to prevent replay attacks and auto-recovers dropped connections.
* **Persistent Ledger Dashboard:** A sleek, glass-morphism dashboard where users can track their invocation history and instantly retrieve, download, or share their permanently stored AI assets.
* **Smart Auto-Recovery:** If an AI model times out or hits a rate limit after payment, the user's transaction hash is preserved, allowing them to retry the API generation for free.

## 🛠 Tech Stack

* **Frontend:** Next.js 14 (App Router), React, Tailwind CSS, Lucide Icons
* **Web3 Integration:** Viem, Wagmi v2, injected wallet connectors + WalletConnect
* **Backend API:** Next.js Serverless Routes (Max duration extended for heavy media rendering)
* **Database:** Supabase (PostgreSQL)
* **AI Models:** Google Gemini 2.5 Flash, Lyria 3, Veo 3.1, Pollinations AI

## ⚙️ Local Development

### 1. Clone & Install
```bash
git clone [https://github.com/investorphem/MasoMind-AI.git](https://github.com/investorphem/MasoMind-AI.git)
cd MasoMind-AI
npm install
```

### 2. Environment Variables
Create a `.env.local` file in the root directory:
```env
# AI Services
GEMINI_API_KEY=your_gemini_api_key

# Supabase Vault (Use the Service Role key for backend security)
NEXT_PUBLIC_SUPABASE_URL=[https://your-project-id.supabase.co](https://your-project-id.supabase.co)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_wc_project_id
```

### 3. Run the Development Server
```bash
npm run dev
```

## 🔗 Smart Contract Details

**Network:** Celo Mainnet
**MasoMindV2 Contract Address:** `0x1d7c2c4c5e41dcdbe90b03d71399383dd1464717`

**Supported Stablecoins:**
* **cUSD:** `0x765DE816845861e75A25fCA122bb6898B8B1282a`
* **USDC:** `0xcebA9300f2b948710d2653dD7B07f33A8B32118C`
* **USDT:** `0x48065fbBE25f71C9282ddf5e1cD6D6A887483d5e`

## 📄 License
MIT License. © 2026 Masonode Technologies Limited.
