import { BrowserProvider, formatEther, parseEther } from "ethers";

export const MONAD_TESTNET_PARAMS = {
  chainId: "0x279f", // 10143 in decimal
  chainName: "Monad Testnet",
  nativeCurrency: {
    name: "Monad",
    symbol: "MON",
    decimals: 18,
  },
  rpcUrls: ["https://testnet-rpc.monad.xyz/"],
  blockExplorerUrls: ["https://testnet.monadexplorer.com/"],
};

export interface Web3WalletState {
  address: string | null;
  balance: string | null;
  chainId: number | null;
  isConnected: boolean;
  isMonadTestnet: boolean;
  error: string | null;
}

// Check if MetaMask is available in the browser window
export function hasMetaMask(): boolean {
  return typeof window !== "undefined" && (window as any).ethereum !== undefined;
}

// Switch MetaMask to Monad Testnet, or prompt to add it if it's not present
export async function switchToMonadTestnet(): Promise<boolean> {
  if (!hasMetaMask()) return false;
  const ethereum = (window as any).ethereum;
  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: MONAD_TESTNET_PARAMS.chainId }],
    });
    return true;
  } catch (switchError: any) {
    // This error code indicates that the chain has not been added to MetaMask.
    if (switchError.code === 4902) {
      try {
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: [MONAD_TESTNET_PARAMS],
        });
        return true;
      } catch (addError) {
        console.error("Failed to add Monad Testnet to MetaMask:", addError);
        return false;
      }
    }
    console.error("Failed to switch to Monad Testnet:", switchError);
    return false;
  }
}

// Connect to MetaMask and load wallet info
export async function connectWallet(): Promise<Web3WalletState> {
  if (!hasMetaMask()) {
    throw new Error("MetaMask is not installed. Please install MetaMask to connect your wallet.");
  }

  try {
    const ethereum = (window as any).ethereum;
    // Request accounts
    const accounts = await ethereum.request({ method: "eth_requestAccounts" });
    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts found. Please unlock your wallet.");
    }

    const provider = new BrowserProvider(ethereum);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    
    // Get chain ID
    const network = await provider.getNetwork();
    const chainIdDecimal = Number(network.chainId);
    const isMonad = chainIdDecimal === 10143;

    // Get native balance
    const balanceWei = await provider.getBalance(address);
    const balance = parseFloat(formatEther(balanceWei)).toFixed(4);

    return {
      address,
      balance,
      chainId: chainIdDecimal,
      isConnected: true,
      isMonadTestnet: isMonad,
      error: null,
    };
  } catch (err: any) {
    console.error("Wallet connection error:", err);
    throw new Error(err?.message || "Failed to connect wallet.");
  }
}

// Mint / Broadcast an On-Chain Academic Reputation Proof to the Monad Testnet
// This broadcasts a real transaction to their own address with a description string stored in the transaction data field.
export async function mintReputationProof(
  certificateName: string,
  category: string,
  points: number
): Promise<{ txHash: string; explorerUrl: string } | null> {
  if (!hasMetaMask()) return null;

  try {
    const ethereum = (window as any).ethereum;
    const provider = new BrowserProvider(ethereum);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();

    // Prepare message payload to record in the tx data
    const proofPayload = {
      app: "AI Campus Hub",
      certName: certificateName,
      category,
      skillPoints: points,
      timestamp: new Date().toISOString(),
    };
    const utf8Bytes = new TextEncoder().encode(JSON.stringify(proofPayload));
    const hexData = "0x" + Array.from(utf8Bytes).map(b => b.toString(16).padStart(2, "0")).join("");

    // Send transaction to self with custom data representation
    const tx = await signer.sendTransaction({
      to: address,
      value: parseEther("0"), // 0 MON
      data: hexData,
    });

    return {
      txHash: tx.hash,
      explorerUrl: `${MONAD_TESTNET_PARAMS.blockExplorerUrls[0]}tx/${tx.hash}`,
    };
  } catch (err) {
    console.error("Error signing Reputation Proof transaction:", err);
    throw err;
  }
}
