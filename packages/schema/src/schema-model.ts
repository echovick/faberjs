import 'reflect-metadata';
import { Model } from '@faber-js/orm';
import type { ValidationRules } from '@faber-js/validation';
import { buildValidationRules } from './validation-bridge';
import { buildOpenApiSchema } from './openapi';
import type { OpenApiSchema, SchemaShape } from './types';

export abstract class SchemaModel extends Model {
  static _schema: SchemaShape = {};

  static rules(fields?: string[], overrides?: ValidationRules): ValidationRules {
    return buildValidationRules(this._schema, this.table, fields, overrides);
  }

  static openapi(): OpenApiSchema {
    return buildOpenApiSchema(this._schema);
  }
}
