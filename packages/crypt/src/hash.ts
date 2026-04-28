import bcrypt from 'bcryptjs';

export type HashDriver = 'bcrypt' | 'argon2';

export interface HashConfig {
  driver?: HashDriver;
  bcryptRounds?: number;
}

export class Hasher {
  readonly #rounds: number;

  constructor(config: HashConfig = {}) {
    this.#rounds = config.bcryptRounds ?? 12;
  }

  async make(value: string): Promise<string> {
    return bcrypt.hash(value, this.#rounds);
  }

  async check(value: string, hashed: string): Promise<boolean> {
    if (!hashed) return false;
    return bcrypt.compare(value, hashed);
  }

  needsRehash(hashed: string): boolean {
    try {
      const rounds = bcrypt.getRounds(hashed);
      return rounds !== this.#rounds;
    } catch {
      return true;
    }
  }
}

export class Hash {
  static #instance: Hasher = new Hasher();

  static configure(config: HashConfig): void {
    Hash.#instance = new Hasher(config);
  }

  static async make(value: string): Promise<string> {
    return Hash.#instance.make(value);
  }

  static async check(value: string, hashed: string): Promise<boolean> {
    return Hash.#instance.check(value, hashed);
  }

  static needsRehash(hashed: string): boolean {
    return Hash.#instance.needsRehash(hashed);
  }
}
