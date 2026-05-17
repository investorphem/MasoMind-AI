# MasoMind SDK 🧠

The official Web3 AI Infrastructure SDK for **Masonode Technologies Limited**. 

MasoMind allows developers to seamlessly integrate high-fidelity AI asset generation and enterprise-grade smart contract auditing into their decentralized applications. Payments are settled automatically on the Celo blockchain using stablecoins (cUSD, USDC, USDT).

## Features
* **Multi-Token Support:** Automatically routes and processes cUSD, USDC, and USDT.
* **Smart Allowances:** Handles token approvals securely under the hood.
* **On-Chain Verification:** Cryptographically verifies payment receipts before utilizing AI quota.

## Installation

Install the SDK and its peer dependency, `viem`:

```bash
npm install masomind-sdk viem
```

## Initialization

Import the SDK and initialize it with an injected Web3 provider (like MetaMask, Valora, or MiniPay).

```javascript
import { MasoMind } from 'masomind-sdk';

// Initialize with the user's browser wallet
const ai = new MasoMind(window.ethereum);
```

## Usage

### 1. Generate AI Assets (Cost: 0.10)
Generate high-quality images based on text prompts. The SDK automatically requests the exact stablecoin amount from the user.

```javascript
try {
  const prompt = "A futuristic neon city on the blockchain";
  // Generates image and pays in cUSD
  const imageUrl = await ai.generateAsset(prompt, 'cUSD'); 
  
  console.log("Asset generated:", imageUrl);
} catch (error) {
  console.error("Generation failed:", error);
}
```

### 2. Audit Smart Contracts (Cost: 0.05)
Get a professional Markdown security report for Solidity or Clarity smart contracts.

```javascript
try {
  const myContractCode = `pragma solidity ^0.8.20; ...`;
  // Audits code and pays in USDT
  const securityReport = await ai.auditContract(myContractCode, 'USDT');
  
  console.log(securityReport);
} catch (error) {
  console.error("Audit failed:", error);
}
```

## Supported Networks
* **Celo Mainnet** (`0xa4ec`)

## License
MIT License - Created by Masonode Technologies Limited.
