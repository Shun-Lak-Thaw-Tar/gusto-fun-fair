import crypto from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export default function generatePaymentReference() {
  const suffix = Array.from(crypto.randomBytes(6), (byte) => ALPHABET[byte % ALPHABET.length]).join('');
  return `FF-ORDER-${suffix}`;
}
