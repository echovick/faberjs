import type { Mailable, MailAddress, MailAttachment } from './mailable';

export interface MailerConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
  fromName?: string;
}

function addressToString(addr: MailAddress): string {
  return addr.name ? `"${addr.name}" <${addr.address}>` : addr.address;
}

function addressesToString(addrs: MailAddress[]): string {
  return addrs.map(addressToString).join(', ');
}

function attachmentToNodemailer(att: MailAttachment): {
  path?: string;
  content?: Buffer | string;
  filename?: string;
  contentType?: string;
} {
  const result: {
    path?: string;
    content?: Buffer | string;
    filename?: string;
    contentType?: string;
  } = {};
  if (att.path !== undefined) result.path = att.path;
  if (att.content !== undefined) result.content = att.content;
  if (att.filename !== undefined) result.filename = att.filename;
  if (att.contentType !== undefined) result.contentType = att.contentType;
  return result;
}

export class Mailer {
  constructor(private config: MailerConfig) {}

  static fromEnv(): Mailer {
    const encryptionEnv = process.env['MAIL_ENCRYPTION'] ?? '';
    const secure = encryptionEnv.toLowerCase() === 'ssl' || encryptionEnv.toLowerCase() === 'tls';

    const config: MailerConfig = {
      port: process.env['MAIL_PORT'] ? Number(process.env['MAIL_PORT']) : 587,
      secure,
    };

    if (process.env['MAIL_HOST'] !== undefined) config.host = process.env['MAIL_HOST'];
    if (process.env['MAIL_USERNAME'] !== undefined) config.user = process.env['MAIL_USERNAME'];
    if (process.env['MAIL_PASSWORD'] !== undefined) config.pass = process.env['MAIL_PASSWORD'];
    if (process.env['MAIL_FROM_ADDRESS'] !== undefined)
      config.from = process.env['MAIL_FROM_ADDRESS'];
    if (process.env['MAIL_FROM_NAME'] !== undefined)
      config.fromName = process.env['MAIL_FROM_NAME'];

    return new Mailer(config);
  }

  async send(mailable: Mailable): Promise<void> {
    const { envelope, content, attachments } = await mailable.resolve();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let nodemailer: any;
    try {
      nodemailer = await import('nodemailer');
    } catch {
      throw new Error('nodemailer is not installed. Run: npm install nodemailer');
    }

    const auth =
      this.config.user || this.config.pass
        ? { user: this.config.user, pass: this.config.pass }
        : undefined;

    const transporter = (nodemailer.default ?? nodemailer).createTransport({
      host: this.config.host ?? 'localhost',
      port: this.config.port ?? 587,
      secure: this.config.secure ?? false,
      ...(auth ? { auth } : {}),
    });

    const defaultFrom: string | undefined = this.config.from
      ? this.config.fromName
        ? `"${this.config.fromName}" <${this.config.from}>`
        : this.config.from
      : undefined;

    const resolvedFrom = envelope.from ? addressToString(envelope.from) : defaultFrom;

    const mailOptions: {
      from?: string;
      to?: string;
      cc?: string;
      bcc?: string;
      replyTo?: string;
      subject?: string;
      html?: string;
      text?: string;
      attachments?: Array<ReturnType<typeof attachmentToNodemailer>>;
    } = {};

    if (resolvedFrom !== undefined) {
      mailOptions.from = resolvedFrom;
    }

    if (envelope.to && envelope.to.length > 0) {
      mailOptions.to = addressesToString(envelope.to);
    }

    if (envelope.cc && envelope.cc.length > 0) {
      mailOptions.cc = addressesToString(envelope.cc);
    }

    if (envelope.bcc && envelope.bcc.length > 0) {
      mailOptions.bcc = addressesToString(envelope.bcc);
    }

    if (envelope.replyTo && envelope.replyTo.length > 0) {
      mailOptions.replyTo = addressesToString(envelope.replyTo);
    }

    if (envelope.subject) {
      mailOptions.subject = envelope.subject;
    }

    if (content.html) {
      mailOptions.html = content.html;
    }

    if (content.text) {
      mailOptions.text = content.text;
    }

    if (attachments.length > 0) {
      mailOptions.attachments = attachments.map(attachmentToNodemailer);
    }

    await transporter.sendMail(mailOptions);
  }
}
