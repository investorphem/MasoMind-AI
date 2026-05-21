import { NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, decodeFunctionData, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo } from 'viem/chains';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '', 
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const CONTRACT_ADDRESS = '0xf5e6bff6cD35833FB9509fd081E5Ca9973fD132f';

const TOKEN_CONFIG = {
  '0x765de816845861e75a25fca122bb6898b8b1282a': { decimals: 18 }, // cUSD
  '0xceba9300f2b948710d2653dd7b07f33a8b32118c': { decimals: 6 },  // USDC
  '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e': { decimals: 6 }   // USDT
};

const ACCOUNT = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY || '0x0');
const CLIENT = createWalletClient({ account: ACCOUNT, chain: celo, transport: http() });
const PUBLIC_CLIENT = createPublicClient({ chain: celo, transport: http() });

export async function POST(req) {
  try {
    const { txHash } = await req.json();

    // 1. Check Database State
    const { data: tx, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('tx_hash', txHash)
      .single();

    if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    if (tx.status !== 'FAILED') return NextResponse.json({ error: "Only FAILED transactions can be refunded" }, { status: 400 });
    if (tx.refund_tx) return NextResponse.json({ error: "Refund already processed" }, { status: 400 });

    // 2. 🚀 BULLETPROOF CHECK: Verify original payment on-chain
    try {
        const receipt = await PUBLIC_CLIENT.getTransactionReceipt({ hash: txHash });
        if (receipt.status !== 'success') {
            return NextResponse.json({ error: "Original transaction failed on-chain" }, { status: 403 });
        }
        if (receipt.to.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) {
            return NextResponse.json({ error: "Payment was not sent to the MasoMind contract" }, { status: 403 });
        }
    } catch (e) {
        return NextResponse.json({ error: "Could not verify on-chain payment" }, { status: 403 });
    }

    // 3. Process Refund
    const config = TOKEN_CONFIG[tx.token_address.toLowerCase()];
    if (!config) return NextResponse.json({ error: "Unsupported token" }, { status: 400 });

    const amounts = { IMAGE: '0.10', AUDIT: '0.05', MUSIC: '0.50', VIDEO: '1.00' };
    const refundAmount = parseUnits(amounts[tx.service_type] || '0', config.decimals);

    // 4. Autonomous Transfer
    const refundHash = await CLIENT.writeContract({
      address: tx.token_address,
      abi: [{
        "name": "transfer",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [{ "name": "to", "type": "address" }, { "name": "amount", "type": "uint256" }],
        "outputs": [{ "name": "", "type": "bool" }]
      }],
      functionName: 'transfer',
      args: [tx.user_address, refundAmount],
    });

    // 5. Finalize DB
    await supabase.from('transactions')
      .update({ status: 'REFUNDED', refund_tx: refundHash })
      .eq('tx_hash', txHash);

    return NextResponse.json({ success: true, refundHash });

  } catch (error) {
    console.error("Autonomous Refund Error:", error);
    return NextResponse.json({ error: "Failed to process autonomous refund" }, { status: 500 });
  }
}
