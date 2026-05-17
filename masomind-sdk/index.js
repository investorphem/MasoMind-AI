import { createWalletClient, createPublicClient, custom, parseUnits } from 'viem';
import { celo } from 'viem/chains';

const CONTRACT_ADDRESS = '0x1d7c2c4c5e41dcdbe90b03d71399383dd1464717';
const BASE_URL = 'https://masomind-sage.vercel.app'; // Your deployed Vercel app URL

const TOKENS = {
  cUSD: { address: '0x765de816845861e75a25fca122bb6898b8b1282a', decimals: 18 },
  USDC: { address: '0xceba9300f2b948710d2653dd7b07f33a8b32118c', decimals: 6 },
  USDT: { address: '0x48065fbbe25f71c9282ddf5e1cd6d6a88248a566', decimals: 6 }
};

const ABI = [
  {"name":"allowance","type":"function","stateMutability":"view","inputs":[{"name":"owner","type":"address"},{"name":"spender","type":"address"}],"outputs":[{"name":"","type":"uint256"}]},
  {"name":"approve","type":"function","stateMutability":"nonpayable","inputs":[{"name":"spender","type":"address"},{"name":"amount","type":"uint256"}]},
  {"name":"executeService","type":"function","stateMutability":"nonpayable","inputs":[{"name":"token","type":"address"},{"name":"amount","type":"uint256"},{"name":"prompt","type":"string"},{"name":"serviceType","type":"string"}]}
];

export class MasoMind {
  constructor(provider) {
    if (!provider) throw new Error("A Web3 provider (e.g., window.ethereum) is required.");
    
    this.publicClient = createPublicClient({ chain: celo, transport: custom(provider) });
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
      await this.publicClient.waitForTransactionReceipt({ hash: approveHash });
    }

    // 3. Execute Payment
    const txHash = await this.walletClient.writeContract({
      account,
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: 'executeService',
      args: [token.address, amountToCharge, prompt, serviceType],
    });

    await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  }

  async generateAsset(prompt, tokenSymbol = 'cUSD') {
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

  async auditContract(code, tokenSymbol = 'cUSD') {
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
}
