import { ethers } from 'ethers';
import { config } from '../config/index.js';
import { encrypt, decrypt } from './encryption.js';

export function createWallet() {
  const wallet = ethers.Wallet.createRandom();

  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: wallet.mnemonic.phrase,
  };
}

export function importWallet(privateKeyOrMnemonic) {
  let wallet;

  if (privateKeyOrMnemonic.includes(' ')) {
    wallet = ethers.Wallet.fromPhrase(privateKeyOrMnemonic);
  } else {
    wallet = new ethers.Wallet(privateKeyOrMnemonic);
  }

  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: wallet.mnemonic?.phrase || null,
  };
}

export function getProvider() {
  return new ethers.JsonRpcProvider(config.blockchain.rpcUrl);
}

export function getWalletFromEncrypted(encryptedPrivateKey) {
  const privateKey = decrypt(encryptedPrivateKey);
  const provider = getProvider();
  return new ethers.Wallet(privateKey, provider);
}

export function formatTo5Decimals(num) {
  return parseFloat(parseFloat(num).toFixed(5));
}

export async function getBalance(address) {
  const provider = getProvider();
  const checksumAddress = ethers.getAddress(address);
  const balance = await provider.getBalance(checksumAddress);
  const formatted = ethers.formatEther(balance);
  return formatTo5Decimals(formatted);
}

export async function getBalanceInWei(address) {
  const provider = getProvider();
  const checksumAddress = ethers.getAddress(address);
  const balance = await provider.getBalance(checksumAddress);
  return balance.toString();
}

export async function sendTransaction(encryptedPrivateKey, toAddress, amount) {
  const wallet = getWalletFromEncrypted(encryptedPrivateKey);
  const checksumToAddress = ethers.getAddress(toAddress);

  const tx = await wallet.sendTransaction({
    to: checksumToAddress,
    value: ethers.parseEther(amount),
  });

  return tx;
}

export async function estimateGas(fromAddress, toAddress, amount) {
  const provider = getProvider();
  const checksumFromAddress = ethers.getAddress(fromAddress);
  const checksumToAddress = ethers.getAddress(toAddress);

  const gasEstimate = await provider.estimateGas({
    from: checksumFromAddress,
    to: checksumToAddress,
    value: ethers.parseEther(amount),
  });

  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice;

  const estimatedFee = gasEstimate * gasPrice;

  return {
    gasLimit: gasEstimate.toString(),
    gasPrice: ethers.formatUnits(gasPrice, 'gwei'),
    estimatedFee: ethers.formatEther(estimatedFee),
    estimatedFeeWei: estimatedFee.toString(),
  };
}

export function isValidAddress(address) {
  return ethers.isAddress(address);
}

export function formatAddress(address) {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export async function getTransactionReceipt(txHash) {
  const provider = getProvider();
  return await provider.getTransactionReceipt(txHash);
}

export async function waitForTransaction(txHash, confirmations = 1) {
  const provider = getProvider();
  return await provider.waitForTransaction(txHash, confirmations);
}
