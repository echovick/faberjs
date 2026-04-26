import { describe, expect, it } from 'vitest';
import { generateFile, makeMigrationClassName, makeMigrationFileName } from './generator';

describe('generateFile()', () => {
  const cwd = '/tmp/test-app';

  describe('make:controller', () => {
    it('generates a Controller subclass with the correct name', () => {
      const result = generateFile('controller', 'User', cwd);
      expect(result.content).toContain('class UserController extends Controller');
      expect(result.content).toContain('@Injectable()');
      expect(result.filePath).toContain('UserController.ts');
    });
  });

  describe('make:service', () => {
    it('generates a Service subclass with @Injectable', () => {
      const result = generateFile('service', 'User', cwd);
      expect(result.content).toContain('class UserService extends Service');
      expect(result.content).toContain('@Injectable()');
      expect(result.filePath).toContain('UserService.ts');
    });

    it('handles PascalCase names correctly', () => {
      const result = generateFile('service', 'UserProfile', cwd);
      expect(result.content).toContain('class UserProfileService');
    });
  });

  describe('make:model', () => {
    it('generates a Model subclass with the correct table name', () => {
      const result = generateFile('model', 'User', cwd);
      expect(result.content).toContain('class User extends Model');
      expect(result.content).toContain("table = 'users'");
      expect(result.filePath).toContain('User.ts');
    });

    it('pluralises table names correctly', () => {
      const result = generateFile('model', 'Category', cwd);
      expect(result.content).toContain("table = 'categories'");
    });
  });

  describe('make:migration', () => {
    it('generates a Migration subclass with correct class and table names', () => {
      const className = makeMigrationClassName('create_users_table');
      const result = generateFile('migration', 'create_users_table', cwd, {
        '{{ClassName}}': className,
        '{{FileName}}': 'migration.ts',
      });
      expect(result.content).toContain('class CreateUsersTable extends Migration');
      expect(result.content).toContain("Schema.create('users'");
    });

    it('extracts table name from add_*_to_* pattern', () => {
      const className = makeMigrationClassName('add_email_to_users');
      const result = generateFile('migration', 'add_email_to_users', cwd, {
        '{{ClassName}}': className,
        '{{FileName}}': 'migration.ts',
      });
      expect(result.content).toContain('class AddEmailToUsers extends Migration');
      expect(result.content).toContain("Schema.create('users'");
    });
  });

  describe('make:job', () => {
    it('generates a Job class', () => {
      const result = generateFile('job', 'SendEmail', cwd);
      expect(result.content).toContain('class SendEmailJob');
      expect(result.filePath).toContain('SendEmailJob.ts');
    });
  });

  describe('make:event', () => {
    it('generates an Event interface', () => {
      const result = generateFile('event', 'UserRegistered', cwd);
      expect(result.content).toContain('interface UserRegisteredEvent');
      expect(result.filePath).toContain('UserRegisteredEvent.ts');
    });
  });

  describe('make:listener', () => {
    it('generates a Listener class', () => {
      const result = generateFile('listener', 'SendWelcomeEmail', cwd);
      expect(result.content).toContain('class SendWelcomeEmailListener');
      expect(result.filePath).toContain('SendWelcomeEmailListener.ts');
    });
  });

  describe('make:middleware', () => {
    it('generates a Middleware class implementing the Middleware interface', () => {
      const result = generateFile('middleware', 'Auth', cwd);
      expect(result.content).toContain('class AuthMiddleware implements Middleware');
    });
  });

  describe('make:command', () => {
    it('generates a Command subclass', () => {
      const result = generateFile('command', 'SendReport', cwd);
      expect(result.content).toContain('class SendReportCommand extends Command');
    });
  });

  describe('make:provider', () => {
    it('generates a ServiceProvider subclass', () => {
      const result = generateFile('provider', 'Payment', cwd);
      expect(result.content).toContain('class PaymentServiceProvider extends ServiceProvider');
    });
  });

  describe('throws for unknown type', () => {
    it('throws an error for an unknown generator type', () => {
      expect(() => generateFile('unknown-type', 'Foo', cwd)).toThrow('Unknown generator type');
    });
  });
});

describe('makeMigrationClassName()', () => {
  it('converts snake_case to PascalCase', () => {
    expect(makeMigrationClassName('create_users_table')).toBe('CreateUsersTable');
    expect(makeMigrationClassName('add_email_to_users')).toBe('AddEmailToUsers');
  });
});

describe('makeMigrationFileName()', () => {
  it('prepends a timestamp to the migration name', () => {
    const fileName = makeMigrationFileName('create_users_table');
    expect(fileName).toMatch(/^\d{4}_\d{2}_\d{2}_\d{6}_create_users_table\.ts$/);
  });
});
