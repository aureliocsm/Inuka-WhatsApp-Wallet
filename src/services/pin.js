import CryptoJS from 'crypto-js';
import { config } from '../config/index.js';
import {
  createUserPin,
  getUserPin,
  updateUserPin,
  incrementPinFailedAttempts,
  resetPinFailedAttempts,
} from '../db/supabase.js';

export function hashPin(pin) {
  return CryptoJS.SHA256(pin + config.encryptionKey).toString();
}

export function isValidPinFormat(pin) {
  const pinStr = pin.toString().trim();
  return /^\d{4,6}$/.test(pinStr);
}

export async function createPin(userId, pin) {
  if (!isValidPinFormat(pin)) {
    throw new Error('PIN must be 4-6 digits');
  }

  const hashedPin = hashPin(pin);

  return createUserPin({
    user_id: userId,
    encrypted_pin: hashedPin,
    failed_attempts: 0,
  });
}

export async function verifyPin(userId, pin) {
  const pinData = await getUserPin(userId);

  if (!pinData) {
    return { success: false, error: 'PIN not set up' };
  }

  if (pinData.locked_until && new Date(pinData.locked_until) > new Date()) {
    const remainingMinutes = Math.ceil(
      (new Date(pinData.locked_until) - new Date()) / 60000
    );
    return {
      success: false,
      error: `Account locked. Try again in ${remainingMinutes} minute(s)`,
      locked: true,
    };
  }

  const hashedPin = hashPin(pin);

  if (hashedPin === pinData.encrypted_pin) {
    await resetPinFailedAttempts(userId);
    return { success: true };
  } else {
    await incrementPinFailedAttempts(userId);
    const updatedPinData = await getUserPin(userId);

    const remainingAttempts = 3 - updatedPinData.failed_attempts;

    if (remainingAttempts <= 0) {
      return {
        success: false,
        error: 'Too many failed attempts. Account locked for 5 minutes',
        locked: true,
      };
    }

    return {
      success: false,
      error: `Incorrect PIN. ${remainingAttempts} attempt(s) remaining`,
      remainingAttempts,
    };
  }
}

export async function changePin(userId, oldPin, newPin) {
  const verifyResult = await verifyPin(userId, oldPin);

  if (!verifyResult.success) {
    return verifyResult;
  }

  if (!isValidPinFormat(newPin)) {
    return { success: false, error: 'New PIN must be 4-6 digits' };
  }

  const hashedPin = hashPin(newPin);

  await updateUserPin(userId, {
    encrypted_pin: hashedPin,
    failed_attempts: 0,
    locked_until: null,
  });

  return { success: true };
}

export async function isPinLocked(userId) {
  const pinData = await getUserPin(userId);

  if (!pinData) return false;

  if (pinData.locked_until && new Date(pinData.locked_until) > new Date()) {
    return true;
  }

  return false;
}
