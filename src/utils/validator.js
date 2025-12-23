export function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/[<>]/g, '');
}

export function validateAmount(amount) {
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0 || num > 1000000) {
    return { valid: false, error: 'Invalid amount' };
  }
  return { valid: true, value: num };
}

export function validateWhatsAppNumber(number) {
  const cleaned = number.replace(/\D/g, '');
  if (cleaned.length < 10 || cleaned.length > 15) {
    return { valid: false, error: 'Invalid phone number' };
  }
  return { valid: true, value: cleaned };
}

export function formatPhoneNumber(number) {
  return number.replace(/\D/g, '');
}
