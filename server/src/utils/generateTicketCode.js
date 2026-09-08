import crypto from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export default function generateTicketCode() {
  const suffix = Array.from(crypto.randomBytes(6), (byte) => ALPHABET[byte % ALPHABET.length]).join('');
  return `FF${String(new Date().getFullYear()).slice(-2)}-${suffix}`;
}
