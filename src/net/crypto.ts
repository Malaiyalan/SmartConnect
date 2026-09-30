import 'react-native-get-random-values';
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';
import { PW_HASH, PW_SALT } from '../config';

export const newKeys = () => nacl.box.keyPair();
export const b64 = encodeBase64;
export const unb64 = decodeBase64;
export const rid = () => encodeBase64(nacl.randomBytes(9)).replace(/[^A-Za-z0-9]/g, 'x');
export const pairCode = () => String(100000 + (new DataView(nacl.randomBytes(4).buffer).getUint32(0) % 900000));

export function checkPassword(user: string, pw: string) {
  const h = Array.from(nacl.hash(decodeUTF8(PW_SALT + pw))).map(x => x.toString(16).padStart(2, '0')).join('');
  return user === 'Malaiyalan' && h === PW_HASH;
}

// 4-digit short auth string: both screens show it so the users can spot a man-in-the-middle.
export function sas(a: Uint8Array, b: Uint8Array) {
  const [x, y] = [encodeBase64(a), encodeBase64(b)].sort();
  const h = nacl.hash(decodeUTF8(x + y));
  return String(((h[0] << 16) | (h[1] << 8) | h[2]) % 10000).padStart(4, '0');
}

// Encrypted, authenticated channel (X25519 + XSalsa20-Poly1305) over line-delimited TCP.
export class Channel {
  key: Uint8Array;
  constructor(mine: nacl.BoxKeyPair, theirPub: Uint8Array) { this.key = nacl.box.before(theirPub, mine.secretKey); }
  seal(o: object) {
    const n = nacl.randomBytes(24);
    return encodeBase64(n) + '.' + encodeBase64(nacl.secretbox(decodeUTF8(JSON.stringify(o)), n, this.key));
  }
  open(s: string) {
    const [n, c] = s.split('.');
    const m = nacl.secretbox.open(decodeBase64(c), decodeBase64(n), this.key);
    if (!m) throw new Error('Decrypt failed');
    return JSON.parse(encodeUTF8(m));
  }
}

export function lineReader(onLine: (l: string) => void) {
  let buf = '';
  return (d: any) => {
    buf += typeof d === 'string' ? d : d.toString('utf8');
    let i;
    while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (l) onLine(l); }
  };
}
