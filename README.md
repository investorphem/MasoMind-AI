# MasoMind Enterprise Suite 🧠

MasoMind is a decentralized, intent-based AI platform built for the Celo ecosystem. It provides enterprise-grade AI tools—including high-fidelity asset generation and professional Web3 smart contract auditing—gated by a seamless, multi-token blockchain payment router.

Developed by **Masonode Technologies Limited**.

## 🚀 Overview

MasoMind bridges the gap between decentralized finance and artificial intelligence. Users can execute prompts and generate assets using stablecoins (cUSD, USDC, USDT) directly from their Web3 wallets (MetaMask, Valora, MiniPay). 

The platform features an ultra-secure, auto-recovering backend that verifies on-chain receipts before querying AI models, ensuring a trustless, hack-proof experience.

## ✨ Key Features

* **Intent-Based AI Agents:** Generate rich media or audit complex Solidity/Clarity smart contracts through simple text prompts.
* **Omni-Token Payment Gateway:** Pay natively with Celo ecosystem stablecoins (`cUSD`, `USDC`, `USDT`).
* **Smart Allowance Auto-Routing:** The frontend handles token approvals and balance checks seamlessly for the user.
* **The Vault (Replay-Attack Protection):** Powered by Supabase, the backend cryptographically locks transaction hashes to prevent replay attacks and auto-recovers dropped connections.
* **Enterprise Ledger Dashboard:** A sleek, dark-mode, glass-morphism dashboard where users can track their total volume, invocation history, and historical AI assets.
* **B2B Infrastructure Ready:** Includes the `@masonode/masomind-sdk` allowing other developers to tap into the MasoMind API.

## 🛠 Tech Stack

* **Frontend:** Next.js 14 (App Router), React, Tailwind CSS (Glassmorphism & Radial Gradients), Lucide Icons
* **Web3 Integration:** Viem, Wagmi, injected wallet connectors
* **Backend API:** Next.js Serverless Routes
* **Database / Security:** Supabase (PostgreSQL)
* **AI Models:** Google Gemini 2.5 Flash (Auditing), Pollinations AI (Image Generation)

## 📦 Project Structure

This repository acts as a monorepo for the MasoMind ecosystem:
* `/app`: The main Next.js consumer application and Enterprise Dashboard.
* `/app/api`: Secure serverless endpoints for on-chain verification and AI routing.
* `/lib/supabase.js`: The database connection manager.
* `/masomind-sdk`: The official Node.js SDK for third-party developer integration.

## ⚙️ Local Development

### 1. Clone & Install
```bash
git clone [https://github.com/investorphem/MasoMind-AI.git](https://github.com/investorphem/MasoMind-AI.git)
cd MasoMind-AI
npm install
```

### 2. Environment Variables
Create a `.env` file in the root directory and add your secure keys:
```env
# AI Services
GEMINI_API_KEY=your_gemini_api_key

# Supabase Vault (Use the Service Role key for backend security)
NEXT_PUBLIC_SUPABASE_URL=[https://your-project-id.supabase.co](https://your-project-id.supabase.co)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## 🔗 Smart Contract Details

**Network:** Celo Mainnet
**MasoMindV2 Contract Address:** `0x1D7C2c4c5E41dcdBe90b03D71399383DD1464717`

**Supported Tokens:**
* **cUSD:** `0x765DE816845861e75A25fCA122bb6898B8B1282a`
* **USDC:** `0xcebA9300f2b948710d2653dD7B07f33A8B32118C`
* **USDT:** `0x48065fbBE25f71C9282ddf5e1cD6D6A88248a566`

## 🛡 Security Protocol

The `executeService` function emits an on-chain event upon payment. The Next.js API intercepts the `txHash`, decodes the payload using `viem`, verifies the exact payment amount and token decimals, and cross-references the Supabase database to ensure the transaction hasn't been spent before utilizing AI quota.

## 📄 License
MIT License. © Masonode Technologies Limited.
