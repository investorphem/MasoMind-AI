import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo } from 'viem/chains';

// 1. Setup Your Developer Account (The Human Owner)
// NEVER commit this private key to GitHub!
const privateKey = '0xYOUR_DEVELOPER_PRIVATE_KEY'; 
const account = privateKeyToAccount(privateKey);

// 2. Setup the Celo Clients
const publicClient = createPublicClient({
  chain: celo,
  transport: http()
});

const walletClient = createWalletClient({
  account,
  chain: celo,
  transport: http()
});

// The official standard ABI for an ERC-8004 Identity Registry
const ERC8004_ABI = parseAbi([
  'function registerAgent(string memory uri) external returns (uint256)'
]);

// IMPORTANT: The official Celo Mainnet ERC-8004 Identity Registry Contract Address
const ERC8004_REGISTRY_ADDRESS = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'; 

async function main() {
  console.log(`Starting ERC-8004 Registration for MasoMind on Celo Mainnet...`);
  console.log(`Executing from Developer Wallet: ${account.address}`);

  // Your actual IPFS CID from Pinata
  const agentURI = "ipfs://bafkreiax2grotdl5rfvuovmk5c6plk3ol6q5rqwdrbwoe6ucgsji3nypyi";

  try {
    console.log(`Minting Agent Identity...`);
    const txHash = await walletClient.writeContract({
      address: ERC8004_REGISTRY_ADDRESS,
      abi: ERC8004_ABI,
      functionName: 'registerAgent',
      args: [agentURI],
    });

    console.log(`Transaction Sent! Hash: ${txHash}`);

    // Wait for the transaction to be mined
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log(`Success! MasoMind is officially registered as an ERC-8004 Agent on Celo.`);

  } catch (error) {
    console.error("Registration failed:", error);
  }
}

main();
