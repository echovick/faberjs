import { Model } from '@faber-js/orm';

export class PasswordResetToken extends Model {
  static table = 'password_reset_tokens';
  static primaryKey = 'email';
  static fillable = ['email', 'token', 'created_at'];
  static timestamps = false;
}
