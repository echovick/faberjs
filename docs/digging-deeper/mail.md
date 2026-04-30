# Mail

`@faber-js/mail` provides a clean, class-based approach to sending email. Each distinct email type — welcome message, password reset, invoice — is represented as a `Mailable` class that encapsulates the message's recipient, subject, and body. Sending is handled through the `Mail` facade, which supports SMTP and is easily faked in tests.

Similar to Laravel's `Mail::to($user)->send(new WelcomeMail())`, FaberJS uses `Mail.to(email).send(mailable)`.

---

## Installation

```bash
pnpm add @faber-js/mail
```

`nodemailer` is bundled as a direct dependency — no separate install is needed.

---

## Configuration

### Register the provider

```typescript
// bootstrap/app.ts
import { MailServiceProvider } from '@faber-js/mail';
import mailConfig from '../config/mail';

app.register(new MailServiceProvider(app, mailConfig));
```

### Create the config file

```typescript
// config/mail.ts
import { env } from '@faber-js/config';

export default {
  driver: env('MAIL_DRIVER', 'smtp') as 'smtp' | 'log',

  smtp: {
    host: env('MAIL_HOST', 'smtp.mailtrap.io'),
    port: Number(env('MAIL_PORT', '587')),
    encryption: env('MAIL_ENCRYPTION', 'tls') as 'tls' | 'ssl' | 'none',
    auth: {
      user: env('MAIL_USERNAME', ''),
      pass: env('MAIL_PASSWORD', ''),
    },
  },

  from: {
    address: env('MAIL_FROM_ADDRESS', 'hello@example.com'),
    name: env('MAIL_FROM_NAME', 'FaberJS App'),
  },
};
```

### `.env` reference

```ini
MAIL_DRIVER=smtp
MAIL_HOST=smtp.mailtrap.io
MAIL_PORT=587
MAIL_ENCRYPTION=tls
MAIL_USERNAME=your-username
MAIL_PASSWORD=your-password
MAIL_FROM_ADDRESS=hello@example.com
MAIL_FROM_NAME="My Application"
```

Use `MAIL_DRIVER=log` during local development to write emails to the application log instead of sending them.

---

## Creating a Mailable

Generate a mailable class with the CLI:

```bash
npx faber make:mail WelcomeMail
```

This creates `app/mail/WelcomeMail.ts`:

```typescript
import { Mailable } from '@faber-js/mail';

export class WelcomeMail extends Mailable {
  build(): unknown {
    return this.subject('Welcome to Our Platform').html(
      '<h1>Welcome!</h1><p>Thanks for signing up.</p>',
    );
  }
}
```

### Injecting data

Pass data through the constructor and use it in `build()`:

```typescript
import { Mailable } from '@faber-js/mail';
import type { User } from '../models/User';

export class WelcomeMail extends Mailable {
  constructor(private readonly user: User) {
    super();
  }

  build(): unknown {
    const name = this.user.getAttribute('name') as string;
    const email = this.user.getAttribute('email') as string;

    return this.to(email, name).subject(`Welcome, ${name}!`).html(`
        <h1>Welcome to FaberJS, ${name}!</h1>
        <p>Your account has been created successfully.</p>
        <p>You can log in at <a href="https://app.example.com">app.example.com</a>.</p>
      `);
  }
}
```

### Plain-text alternative

Provide a plain-text version alongside the HTML for mail clients that don't render HTML:

```typescript
return this.subject('Welcome!')
  .html('<h1>Welcome!</h1>')
  .text('Welcome!\n\nThank you for signing up.');
```

### Attachments

```typescript
return this.subject('Your Invoice')
  .html('<p>Please find your invoice attached.</p>')
  .attach('/storage/invoices/INV-0042.pdf', {
    filename: 'invoice-april-2026.pdf',
    contentType: 'application/pdf',
  });
```

---

## The `Mailable` Fluent API

| Method                                   | Description                                          |
| ---------------------------------------- | ---------------------------------------------------- |
| `.to(address, name?)`                    | Set the primary recipient                            |
| `.cc(address, name?)`                    | Add a CC recipient                                   |
| `.bcc(address, name?)`                   | Add a BCC recipient                                  |
| `.from(address, name?)`                  | Override the sender (uses config default if omitted) |
| `.replyTo(address, name?)`               | Set the Reply-To header                              |
| `.subject(text)`                         | Set the subject line                                 |
| `.html(content)`                         | Set the HTML body                                    |
| `.text(content)`                         | Set the plain-text body                              |
| `.attach(path, options?)`                | Add a file attachment                                |
| `.priority('high' \| 'normal' \| 'low')` | Set the message priority header                      |

---

## Sending Mail

### Via the `Mail` facade

```typescript
import { Mail } from '@faber-js/mail';
import { WelcomeMail } from '../mail/WelcomeMail';

// Inside a controller or service:
await Mail.send(new WelcomeMail(user));
```

### `Mail.to()` shorthand

When the recipient is not set inside `build()`, pass it directly to `Mail.to()`:

```typescript
await Mail.to(user.getAttribute('email') as string).send(new WelcomeMail(user));
```

You can chain `.cc()` and `.bcc()` on the same call:

```typescript
await Mail.to('recipient@example.com')
  .cc('manager@example.com')
  .bcc('audit@example.com')
  .send(new WelcomeMail(user));
```

### Queueing mail

Long-running SMTP calls should not block the HTTP response. Use `queue()` to dispatch the send to a background worker:

```bash
pnpm add @faber-js/queue
```

```typescript
// Dispatch to the default queue
await Mail.to(email).queue(new WelcomeMail(user));

// Dispatch to a named queue
await Mail.to(email).onQueue('emails').queue(new WelcomeMail(user));
```

---

## Sending from Controllers

```typescript
// app/controllers/AuthController.ts
import { Injectable } from '@faber-js/core';
import { Controller } from '@faber-js/router';
import { Mail } from '@faber-js/mail';
import type { Request } from '@faber-js/http';
import { Response } from '@faber-js/http';
import { User } from '../models/User';
import { WelcomeMail } from '../mail/WelcomeMail';

@Injectable()
export class AuthController extends Controller {
  async register(req: Request): Promise<Response> {
    const data = req.validated() as { name: string; email: string; password: string };

    const user = await User.create<User>(data);

    // Queue the welcome email so it doesn't block the response
    await Mail.to(data.email).queue(new WelcomeMail(user));

    return this.json({ data: user }, 201);
  }
}
```

---

## Password Reset Emails

A common pattern pairs `@faber-js/mail` with a signed URL from `@faber-js/crypt`:

```typescript
import { URL } from '@faber-js/crypt';
import { Mailable } from '@faber-js/mail';

export class PasswordResetMail extends Mailable {
  constructor(
    private readonly email: string,
    private readonly resetUrl: string,
  ) {
    super();
  }

  build(): unknown {
    return this.to(this.email).subject('Reset Your Password').html(`
        <p>Click the link below to reset your password. This link expires in 60 minutes.</p>
        <p><a href="${this.resetUrl}">Reset Password</a></p>
        <p>If you did not request a password reset, you can ignore this email.</p>
      `);
  }
}
```

```typescript
// In a controller:
const resetUrl = URL.temporarySignedRoute('password.reset', 3600, {
  email: req.input('email'),
});
await Mail.to(req.input('email')).send(new PasswordResetMail(req.input('email'), resetUrl));
```

---

## Testing

`Mail.fake()` swaps the real mailer for an in-memory recorder. No emails are sent; you assert against what was recorded.

```typescript
import { Mail } from '@faber-js/mail';
import { WelcomeMail } from '../mail/WelcomeMail';

beforeEach(() => {
  Mail.fake();
});

test('welcome email is sent on registration', async () => {
  // trigger the action that sends mail
  await registerUser({ email: 'alice@example.com', name: 'Alice' });

  // assert at least one WelcomeMail was sent
  Mail.assertSent(WelcomeMail);

  // assert it was sent to a specific address
  Mail.assertSent(WelcomeMail, (mail) => {
    return mail.hasTo('alice@example.com');
  });
});

test('no mail is sent on validation failure', async () => {
  await expect(registerUser({ email: '' })).rejects.toThrow();

  Mail.assertNothingSent();
});

test('exactly one welcome email is sent', async () => {
  await registerUser({ email: 'alice@example.com' });

  Mail.assertSentCount(WelcomeMail, 1);
});
```

### Fake assertion API

| Method                                   | Description                                                     |
| ---------------------------------------- | --------------------------------------------------------------- |
| `Mail.assertSent(Mailable, callback?)`   | Assert a mailable was sent; optional callback for custom checks |
| `Mail.assertNotSent(Mailable)`           | Assert a mailable was NOT sent                                  |
| `Mail.assertNothingSent()`               | Assert no mail was sent at all                                  |
| `Mail.assertSentCount(Mailable, count)`  | Assert exactly `count` instances were sent                      |
| `Mail.assertQueued(Mailable, callback?)` | Assert a mailable was queued                                    |

---

## Driver Reference

| Driver | Description                                                             |
| ------ | ----------------------------------------------------------------------- |
| `smtp` | Send via an SMTP relay (Mailtrap, Mailgun, SendGrid, SES, Resend, etc.) |
| `log`  | Write the email body to the application log; nothing is delivered       |

::: tip Choosing an SMTP provider
FaberJS works with any SMTP-compatible provider out of the box. For transactional email in production, consider Resend (`smtp.resend.com:465`), Mailgun, or AWS SES — configure them by pointing `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, and `MAIL_PASSWORD` at the provider's SMTP credentials.
:::
