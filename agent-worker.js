import { createWalletClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo } from 'viem/chains';

// 1. The AGENT'S Private Key (Not your developer key!)
// Export the private key from the new wallet you generated for MasoMind
const agentPrivateKey = '0xYOUR_NEW_AGENT_PRIVATE_KEY';
const agentAccount = privateKeyToAccount(agentPrivateKey);

const walletClient = createWalletClient({
  account: agentAccount,
  chain: celo,
  transport: http()
});

async function runAgentTask() {
  console.log(`Waking up MasoMind Agent...`);
  console.log(`Agent Identity Address: ${agentAccount.address}`);
  
  try {
    console.log(`Executing autonomous on-chain ping...`);
    
    // The agent autonomously sends a 0-value transaction to itself 
    // Data payload translates to: "MasoMind Agent Active"
    const txHash = await walletClient.sendTransaction({
      to: agentAccount.address,
      value: parseUnits('0', 18),
      data: '0x4d61736f4d696e64204167656e7420416374697665' 
    });

    console.log(`Agent Transaction Successful!`);
    console.log(`Tx Hash: ${txHash}`);
    console.log(`✅ REQUIREMENT 3 COMPLETE! Submit this hash to the hackathon judges.`);
    
  } catch (err) {
    console.error("Agent failed to execute tx:", err);
    console.log("Did you remember to send a tiny amount of CELO to the Agent's wallet for gas?");
  }
}

runAgentTask();
