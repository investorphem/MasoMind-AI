import { createWalletClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo } from 'viem/chains';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY);
const client = createWalletClient({ account, chain: celo, transport: http() });

export async function POST(req) {
  const { txHash, userAddress, serviceType } = await req.json();

  // 1. Get exact refund amount based on service
  const amounts = { IMAGE: '0.10', AUDIT: '0.05', MUSIC: '0.50', VIDEO: '1.00' };
  const refundAmount = parseUnits(amounts[serviceType] || '0', 6);

  // 2. Autonomous Transfer
  const refundHash = await client.writeContract({
    address: '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e', // USDT
    abi: [{"name":"transfer","type":"function","stateMutability":"nonpayable","inputs":[{"name":"to","type":"address"},{"name":"amount","type":"uint256"}],"outputs":[{"name":"","type":"bool"}]}],
    functionName: 'transfer',
    args: [userAddress, refundAmount],
  });

  // 3. Log the refund
  await supabase.from('transactions').update({ status: 'REFUNDED', refund_tx: refundHash }).eq('tx_hash', txHash);

  return Response.json({ success: true, refundHash });
}
