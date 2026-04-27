import type { AuthUser } from '@faberjs/http';
import type { GateContract, PolicyContract } from './types';

type PolicyConstructor = new () => PolicyContract;

export class Gate implements GateContract {
  readonly #policies = new Map<object, PolicyConstructor>();

  registerPolicy<T extends object>(
    modelClass: { prototype: T },
    policyClass: PolicyConstructor,
  ): void {
    this.#policies.set(modelClass, policyClass);
  }

  async allows(ability: string, user: AuthUser | null, model?: unknown): Promise<boolean> {
    if (!user) return false;

    const policyClass = model !== undefined ? this.#findPolicy(model) : undefined;
    if (!policyClass) return false;

    const policy = new policyClass();

    if (policy.before) {
      const beforeResult = await policy.before(user, ability);
      if (beforeResult !== undefined) return beforeResult;
    }

    const policyRecord = policy as Record<string, unknown>;
    const method = policyRecord[ability];
    if (typeof method !== 'function') return false;

    const result = await (method as (u: AuthUser, m: unknown) => Promise<boolean> | boolean)(
      user,
      model,
    );
    return Boolean(result);
  }

  async denies(ability: string, user: AuthUser | null, model?: unknown): Promise<boolean> {
    return !(await this.allows(ability, user, model));
  }

  #findPolicy(model: unknown): PolicyConstructor | undefined {
    if (typeof model !== 'object' || model === null) return undefined;
    const ctor = model.constructor as object;
    return this.#policies.get(ctor);
  }
}
