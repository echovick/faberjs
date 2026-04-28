import type { AuthUser, Request } from '@faber-js/http';
import { ForbiddenException, ValidationException } from '@faber-js/http';
import type { InputData, RuleValue, ValidationRules } from './types';
import { Validator } from './validator';

export abstract class FormRequest {
  readonly #request: Request;

  constructor(request: Request) {
    this.#request = request;
  }

  abstract rules(): ValidationRules;

  authorize(): boolean | Promise<boolean> {
    return true;
  }

  protected user(): AuthUser | null {
    return this.#request.user();
  }

  protected input(key: string): RuleValue {
    return this.#request.input(key) as RuleValue;
  }

  protected param(key: string): RuleValue {
    return this.#request.route(key) as RuleValue;
  }

  protected all(): InputData {
    return this.#request.all() as InputData;
  }

  async validate(): Promise<InputData> {
    const authorized = await Promise.resolve(this.authorize());
    if (!authorized) {
      throw new ForbiddenException('This action is unauthorized.');
    }

    const data = this.all();
    const validator = new Validator(data, this.rules());
    const result = await validator.validate();

    if (!result.passes) {
      throw new ValidationException(result.errors);
    }

    this.#request.setValidated(data);
    return data;
  }
}
