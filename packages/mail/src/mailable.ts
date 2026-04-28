export interface MailAddress {
  address: string;
  name?: string;
}

export interface MailEnvelope {
  from?: MailAddress;
  to?: MailAddress[];
  cc?: MailAddress[];
  bcc?: MailAddress[];
  replyTo?: MailAddress[];
  subject?: string;
}

export interface MailContent {
  html?: string;
  text?: string;
}

export interface MailAttachment {
  path?: string;
  content?: Buffer | string;
  filename?: string;
  contentType?: string;
}

function normalizeAddresses(address: string | string[], name?: string): MailAddress[] {
  if (Array.isArray(address)) {
    return address.map((a) => ({ address: a }));
  }
  return name ? [{ address, name }] : [{ address }];
}

export abstract class Mailable {
  protected envelope: MailEnvelope = {};
  protected content: MailContent = {};
  protected attachments: MailAttachment[] = [];

  from(address: string, name?: string): this {
    this.envelope.from = name ? { address, name } : { address };
    return this;
  }

  to(address: string | string[], name?: string): this {
    const incoming = normalizeAddresses(address, name);
    this.envelope.to = [...(this.envelope.to ?? []), ...incoming];
    return this;
  }

  cc(address: string | string[], name?: string): this {
    const incoming = normalizeAddresses(address, name);
    this.envelope.cc = [...(this.envelope.cc ?? []), ...incoming];
    return this;
  }

  bcc(address: string | string[], name?: string): this {
    const incoming = normalizeAddresses(address, name);
    this.envelope.bcc = [...(this.envelope.bcc ?? []), ...incoming];
    return this;
  }

  replyTo(address: string, name?: string): this {
    const entry: MailAddress = name ? { address, name } : { address };
    this.envelope.replyTo = [...(this.envelope.replyTo ?? []), entry];
    return this;
  }

  subject(subject: string): this {
    this.envelope.subject = subject;
    return this;
  }

  html(html: string): this {
    this.content.html = html;
    return this;
  }

  text(text: string): this {
    this.content.text = text;
    return this;
  }

  attach(path: string, options?: { filename?: string; contentType?: string }): this {
    this.attachments.push({ path, ...options });
    return this;
  }

  abstract build(): unknown;

  async resolve(): Promise<{
    envelope: MailEnvelope;
    content: MailContent;
    attachments: MailAttachment[];
  }> {
    await this.build();
    return {
      envelope: this.envelope,
      content: this.content,
      attachments: this.attachments,
    };
  }
}
