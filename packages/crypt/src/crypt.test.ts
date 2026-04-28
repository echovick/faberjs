import { describe, it, expect, beforeEach } from 'vitest';
import { Crypt, DecryptException } from './crypt';
import { Hash } from './hash';

const TEST_KEY = 'a'.repeat(32);

beforeEach(() => {
  Crypt.configure(TEST_KEY);
});

describe('Crypt', () => {
  describe('encryptString / decryptString roundtrip', () => {
    it('encrypts and decrypts a plain string', () => {
      const plaintext = 'hello world';
      const ciphertext = Crypt.encryptString(plaintext);
      expect(Crypt.decryptString(ciphertext)).toBe(plaintext);
    });

    it('handles unicode strings', () => {
      const plaintext = 'こんにちは🌟';
      const ciphertext = Crypt.encryptString(plaintext);
      expect(Crypt.decryptString(ciphertext)).toBe(plaintext);
    });
  });

  describe('wrong key throws DecryptException', () => {
    it('throws DecryptException when decrypting with a different key', () => {
      const ciphertext = Crypt.encryptString('secret message');
      Crypt.configure('b'.repeat(32));
      expect(() => Crypt.decryptString(ciphertext)).toThrow(DecryptException);
    });

    it('throws DecryptException for arbitrary garbage input', () => {
      expect(() => Crypt.decryptString('not-base64!!!')).toThrow(DecryptException);
    });

    it('throws DecryptException for valid base64 but malformed JSON payload', () => {
      const fake = Buffer.from('not json').toString('base64');
      expect(() => Crypt.decryptString(fake)).toThrow(DecryptException);
    });
  });

  describe('random IV', () => {
    it('two encryptions of the same plaintext produce different ciphertext', () => {
      const a = Crypt.encryptString('same input');
      const b = Crypt.encryptString('same input');
      expect(a).not.toBe(b);
    });
  });
});

describe('Hash', () => {
  describe('make', () => {
    it('returns a bcrypt hash starting with $2', async () => {
      const hash = await Hash.make('password123');
      expect(hash).toMatch(/^\$2/);
    });

    it('generates different hashes for the same password (salt)', async () => {
      const h1 = await Hash.make('same');
      const h2 = await Hash.make('same');
      expect(h1).not.toBe(h2);
    });
  });

  describe('check', () => {
    it('returns true for the correct password', async () => {
      const hash = await Hash.make('correct-horse');
      expect(await Hash.check('correct-horse', hash)).toBe(true);
    });

    it('returns false for the wrong password', async () => {
      const hash = await Hash.make('correct-horse');
      expect(await Hash.check('wrong-horse', hash)).toBe(false);
    });

    it('returns false when hash is empty string', async () => {
      expect(await Hash.check('password', '')).toBe(false);
    });
  });

  describe('needsRehash', () => {
    it('returns false for a freshly generated hash (rounds match default)', async () => {
      Hash.configure({ bcryptRounds: 12 });
      const hash = await Hash.make('password');
      expect(Hash.needsRehash(hash)).toBe(false);
    });

    it('returns true when hash was generated with fewer rounds than current config', async () => {
      Hash.configure({ bcryptRounds: 8 });
      const lowRoundsHash = await Hash.make('password');

      Hash.configure({ bcryptRounds: 12 });
      expect(Hash.needsRehash(lowRoundsHash)).toBe(true);
    });

    it('returns true for a non-bcrypt string', () => {
      expect(Hash.needsRehash('not-a-bcrypt-hash')).toBe(true);
    });
  });
});
