import { scrypt } from '@noble/hashes/scrypt.js';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { randomBytes } from '@noble/ciphers/utils.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

// what keeps a live session private. the invite password is turned (slowly, so guessing it is slow) into two things: a public
// id the relay uses to match the guest to the host, and a key that scrambles everything the two of them send. the relay and
// any tunnel in between only ever see the id and scrambled bytes, never the password or the key.

const SALT = new TextEncoder().encode('asterism-live-session-v1');

export interface InviteKeys { id: string; key: Uint8Array }

export function deriveInvite(password: string): InviteKeys {
  const clean = password.trim().toLowerCase().replace(/\s+/g, '-');
  const out = scrypt(new TextEncoder().encode(clean), SALT, { N: 2 ** 14, r: 8, p: 1, dkLen: 64 });
  return { id: bytesToHex(out.subarray(0, 32)), key: out.slice(32) };
}

const NONCE = 24;

export function seal(key: Uint8Array, data: Uint8Array): Uint8Array {
  const nonce = randomBytes(NONCE);
  const body = xchacha20poly1305(key, nonce).encrypt(data);
  const out = new Uint8Array(NONCE + body.length);
  out.set(nonce);
  out.set(body, NONCE);
  return out;
}

// null when the bytes were not made with this key, or were changed on the way
export function open(key: Uint8Array, data: Uint8Array): Uint8Array | null {
  if (data.length < NONCE + 16) return null;
  try { return xchacha20poly1305(key, data.subarray(0, NONCE)).decrypt(data.subarray(NONCE)); } catch { return null; }
}

// short words that are easy to say aloud. four of them is about 30 bits, which with a slow key function, a one-use invite that
// expires, and a relay that slows guessing, is plenty for a writing session between friends.
const WORDS = (
  'amber apple arrow aspen badge baker beach birch blaze bloom brick brook cabin candy cedar chalk charm cider cliff cloud clover comet coral crane creek crown daisy delta dune eagle ember fable falcon fern field finch flame flint forest fox frost garden gem ginger glade glow grove harbor hazel heron hill honey iris island ivory jade jewel juniper kite lake lamp lantern lark leaf lemon light lily lotus maple marsh meadow mint mist moon moss nest north oak ocean olive opal orchid otter owl paper pearl pebble pine plum pond poppy quartz quill rain raven reed ridge river robin rose sage sail sand shell silver sky snow sparrow spring star stone storm summer sun swan thistle thorn tide tulip valley velvet violet willow wind winter wren yarrow zephyr ' +
  'anchor apricot atlas aurora basil bay beacon berry bonfire breeze bridge bronze butter canyon carrot cherry cobalt copper cotton cricket crystal dawn dew dove dragon dusk echo elm emerald feather fig fjord fossil galaxy garnet glacier granite hawk hollow indigo jasmine jungle kettle lagoon lavender linen lynx magnet marble mirror mountain nectar nutmeg oasis onyx orbit paddle panda peach pepper pillow planet prairie pumpkin radar rainbow ribbon saffron salmon sapphire scarlet shadow sketch spruce sunset teapot thunder topaz tundra umber vapor walnut whale yonder zenith'
).split(' ');

export function generatePassword(words = 4): string {
  const pick = new Uint32Array(words);
  crypto.getRandomValues(pick);
  return [...pick].map((n) => WORDS[n % WORDS.length]).join('-');
}

// a rejoin ticket: given to a guest once they are in, so they can come back on their own if the connection drops. it is random, so
// no slow key function is needed; the relay only ever sees its hash.
export const newTicket = (): string => bytesToHex(randomBytes(24));
export const ticketId = (ticket: string): string => bytesToHex(sha256(new TextEncoder().encode(`asterism-rejoin:${ticket}`)));
