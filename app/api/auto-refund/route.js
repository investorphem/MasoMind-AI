import { NextResponse } from 'next/server';
import { createWalletClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo } from 'viem/chains';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase using NEXT_PUBLIC variables
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '', 
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Token Registry: Address -> Decimals
const TOKEN_CONFIG = {
  '0x765de816845861e75a25fca122bb6898b8b1282a': { decimals: 18 }, // cUSD
  '0xceba9300f2b948710d2653dd7b07f33a8b32118c': { decimals: 6 },  // USDC
  '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e': 6   // USDT
};

const ACCOUNT = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY || '0x0');
const CLIENT = createWalletClient({ account: ACCOUNT, chain: celo, transport: http() });

export async function POST(req) {
  try {
    const { txHash, userAddress, serviceType, tokenAddress } = await req.json();

    // 1. Validate Token Config
    const config = TOKEN_CONFIG[tokenAddress.toLowerCase()];
    if (!config) {
      return NextResponse.json({ error: "Unsupported token for refund" }, { status: 400 });
    }

    // 2. Define refund amounts
    const amounts = { IMAGE: '0.10', AUDIT: '0.05', MUSIC: '0.50', VIDEO: '1.00' };
    const refundAmount = parseUnits(amounts[serviceType] || '0', config.decimals);

    // 3. Autonomous Transfer
    const refundHash = await CLIENT.writeContract({
      address: tokenAddress,
      abi: [{
        "name": "transfer",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
          { "name": "to", "type": "address" },
          { "name": "amount", "type": "uint256" }
        ],
        "outputs": [{ "name": "", "type": "bool" }]
      }],
      functionName: 'transfer',
      args: [userAddress, refundAmount],
    });

    // 4. Log the refund
    await supabase.from('transactions')
      .update({ 
        status: 'REFUNDED', 
        refund_tx: refundHash 
      })
      .eq('tx_hash', txHash);

    return NextResponse.json({ success: true, refundHash });

  } catch (error) {
    console.error("Autonomous Refund Error:", error);
    return NextResponse.json({ error: "Failed to process autonomous refund" }, { status: 500 });
  }
}
