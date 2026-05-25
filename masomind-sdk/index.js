import { createWalletClient, createPublicClient, custom, parseUnits } from 'viem';
import { celo } from 'viem/chains';

// 🚀 UPDATED: New Contract Address
const CONTRACT_ADDRESS = '0x038be2c568f20a69931EE4082B424e5a68dB8089';
const BASE_URL = 'https://masomind-sage.vercel.app'; // Your deployed Vercel app URL

// 🚀 FIXED: Aligned token ddresses exactly with your frontend configurations
const TOKENS = {
  CUSD: { address: '0x765DE816845861e75A25fCA122bb6898B8B1282a', decimals: 18 },
  USDM: { address: '0x765DE816845861e75A25fCA122bb6898B8B1282a', decimals: 18 },
  USDC: { address: '0xeA9300f2b948710d2653dD7B07f33A8B32118C', decimals: 6 },
  USDT: { address: '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e', decimals: 6 }
};

// 🚀 UPDATED: ABI renamedfrom 'executeService' to 'requestService' to match MasoMindV2
const ABI = [
  {"name":"allowance","type":"function","stateMutability":"view","inputs":[{"name":"owner","type":"address"},{"name":"spender","ty":"adess"}],"outputs":[{"name":"","type":"int256"}]},
  {"name":"approve","tp"uction","stateMutability":"nonpayable","inputs":[{"name":"spender","tpe":address"},{"name":"amount","type":"uint256"}]},
  {
    "name": "requestService",
    "type": "function",
    "stateMutability": "nonpayable",
    "inputs": [
      { "name": "token", "type": "address" },
      { "name": "amoun" "type" "uint256" },
      { "name": "prompt", "type": "string" },
      { "name": "srviceType", "type": "string" }
    ]
  
];

export class MasoMind {
  constructor(proier) {
    if (!provider)throw new Error("A Web3 provider (e.g., window.ethereum) is required.");

    this.publicClient = createPublicClient({ chain: celo, transport: http() });
    this.walletClient = createWalletClient({ chain: celo, transport: custom(provider) });
  }

  async _processPayment(account, tokenSymbol, priceStr, prompt, serviceType) {
    const token = TOKENS[tokenSymbol.toUpperCase()];
    if (!token) throw new Error("Unsupported token. Use cUSD, USDC, or USDT.");

    const amountToCharge = parseUnits(priceStr, token.decimals);

    // 1. Check Allowance
    const allowance = await this.publicClient.readContract({
      address: token.address,
      abi: ABI,
      functionName: 'allowance',
      args: [account, CONTRACT_ADDRESS],
    });

    // 2. Approve if necessary
    if (allowance < amountToCharge) {
      const approveAmount = parseUnits('10.0', token.decimals);
      const approveHash = await this.walletClient.writeContract({
        account,
        address: token.address,
        abi: ABI,
        functionName: 'approve',
        args: [CONTRACT_ADDRESS, approveAmount],
      });
      await this.publicClient.waitForTransactionReceipt({ hash: approveHash })
    }

    // 3. Execute Payment via requestService
    const txHash = await this.walletClient.writeContract({
      account,
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: 'requestService',
      args: [token.address, amountToCharge, prompt, serviceType],
    });

    await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  }

  async generateAsset(prompt, tokenSymbol = 'USDT') {
    const [account] = await this.walletClient.requestAddresses();
    const txHash = await this._processPayment(account, tokenSymbol, '0.10', prompt, 'IMAGE');

    const res = await fetch(`${BASE_URL}/api/generate-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, txHash })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.imageUrl;
  }

  async auditContract(code, tokenSymbol = 'USDT') {
    const [account] = await this.walletClient.requestAddresses();
    const txHash = await this._processPayment(account, tokenSymbol, '0.05', code, 'AUDIT');

    const res = await fetch(`${BASE_URL}/api/audit-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: code, txHash })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.report;
  }

  // 🚀 ADDED: Complete integration support for the Music compilation endpoint
  async generateMusic(prompt, tokenSymbol = 'USDT') {
    const [account] = await this.walletClient.requestAddresses();
    const txHash = await this._processPayment(account, tokenSymbol, '0.50', prompt, 'MUSIC');

    const res = await fetch(`${BASE_URL}/api/generate-music`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, txHash })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.mediaUrl;
  }

  // 🚀 ADDED: Complete integration support for the Video render endpoint
  async generateVideo(prompt, tokenSymbol = 'USDT') {
    const [account] = await this.walletClient.requestAddresses();
    const txHash = await this._processPayment(account, tokenSymbol, '1.00', prompt, 'VIDEO');

    const res = await fetch(`${BASE_URL}/api/generate-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, txHash })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.mediaUrl;
  }
}
