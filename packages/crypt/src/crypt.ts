import { createCipheriv, createDecipheriv, randomBytes, createHmac } from 'node:crypto';

export class DecryptException extends Error {
  constructor(message = 'The payload is invalid.') {
    super(message);
    this.name = 'DecryptException';
  }
}

export class Encrypter {
  readonly #key: Buffer;
  readonly #algo = 'aes-256-gcm';

  constructor(key: string) {
    // Accept 32-byte hex key (64 chars) or raw string — derive consistent 32-byte buffer
    if (/^[0-9a-f]{64}$/i.test(key)) {
      this.#key = Buffer.from(key, 'hex');
    } else {
      // Pad/truncate to 32 bytes via SHA-256 derivation
      const hash = createHmac('sha256', 'faberjs').update(key).digest();
      this.#key = hash;
    }
  }

  encryptString(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(this.#algo, this.#key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const payload = {
      iv: iv.toString('base64'),
      value: encrypted.toString('base64'),
      tag: tag.toString('base64'),
    };
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  decryptString(ciphertext: string): string {
    let payload: { iv: string; value: string; tag: string };
    try {
      payload = JSON.parse(Buffer.from(ciphertext, 'base64').toString('utf8')) as {
        iv: string;
        value: string;
        tag: string;
      };
    } catch {
      throw new DecryptException();
    }

    if (!payload.iv || !payload.value || !payload.tag) throw new DecryptException();

    try {
      const iv = Buffer.from(payload.iv, 'base64');
      const encrypted = Buffer.from(payload.value, 'base64');
      const tag = Buffer.from(payload.tag, 'base64');
      const decipher = createDecipheriv(this.#algo, this.#key, iv);
      decipher.setAuthTag(tag);
      return decipher.update(encrypted) + decipher.final('utf8');
    } catch {
      throw new DecryptException('Could not decrypt the value — key may have changed.');
    }
  }
}

export class Crypt {
  static #instance: Encrypter | null = null;

  static configure(key: string): void {
    Crypt.#instance = new Encrypter(key);
  }

  private static getInstance(): Encrypter {
    if (!Crypt.#instance) {
      const key = process.env['APP_KEY'] ?? '';
      if (!key) throw new Error('APP_KEY is not set. Run: faber key:generate');
      Crypt.#instance = new Encrypter(key);
    }
    return Crypt.#instance;
  }

  static encryptString(value: string): string {
    return Crypt.getInstance().encryptString(value);
  }

  static decryptString(ciphertext: string): string {
    return Crypt.getInstance().decryptString(ciphertext);
  }
}
