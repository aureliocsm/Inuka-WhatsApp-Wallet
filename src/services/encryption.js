import CryptoJS from 'crypto-js';
import { config } from '../config/index.js';

export function encrypt(text) {
  if (!config.encryption.key) {
    throw new Error('Encryption key not configured');
  }
  return CryptoJS.AES.encrypt(text, config.encryption.key).toString();
}

export function decrypt(encryptedText) {
  if (!config.encryption.key) {
    throw new Error('Encryption key not configured');
  }
  const bytes = CryptoJS.AES.decrypt(encryptedText, config.encryption.key);
  return bytes.toString(CryptoJS.enc.Utf8);
}

export function hashPin(pin) {
  return CryptoJS.SHA256(pin).toString();
}

export function verifyPin(pin, hashedPin) {
  return hashPin(pin) === hashedPin;
}
