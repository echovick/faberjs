type EventHandler = (data: unknown) => void;
type PresenceMemberData = Record<string, unknown>;

interface ChannelOptions {
  readonly url: string;
  readonly token?: string;
}

export class FaberChannels {
  readonly #url: string;
  readonly #token: string | undefined;
  #ws: WebSocket | null = null;
  readonly #channels = new Map<string, ClientChannel>();
  #connected = false;
  readonly #pendingSubscribes: string[] = [];

  constructor(options: ChannelOptions) {
    this.#url = options.url;
    this.#token = options.token;
    this.#connect();
  }

  #connect(): void {
    this.#ws = new WebSocket(this.#url);

    this.#ws.addEventListener('open', () => {
      this.#connected = true;
      for (const channelName of this.#pendingSubscribes) {
        this.#subscribe(channelName);
      }
      this.#pendingSubscribes.length = 0;
    });

    this.#ws.addEventListener('message', (ev: MessageEvent) => {
      const ev2 = ev as MessageEvent & { data: string };
      let msg: unknown;
      try {
        msg = JSON.parse(ev2.data);
      } catch {
        return;
      }
      this.#dispatch(msg);
    });

    this.#ws.addEventListener('close', () => {
      this.#connected = false;
    });
  }

  #subscribe(channelName: string): void {
    if (!this.#connected || !this.#ws) {
      this.#pendingSubscribes.push(channelName);
      return;
    }
    this.#ws.send(JSON.stringify({ type: 'subscribe', channel: channelName, token: this.#token }));
  }

  #dispatch(msg: unknown): void {
    if (typeof msg !== 'object' || msg === null) return;
    const m = msg as Record<string, unknown>;

    if (m['type'] === 'event') {
      const ch = this.#channels.get(m['channel'] as string);
      ch?.dispatchEvent(m['event'] as string, m['data']);
      return;
    }

    if (
      m['type'] === 'presence.init' ||
      m['type'] === 'presence.joined' ||
      m['type'] === 'presence.left'
    ) {
      for (const ch of this.#channels.values()) {
        if (ch instanceof PresenceChannel) {
          ch.dispatchPresence(m['type'] as string, m);
        }
      }
    }
  }

  private(channelName: string): ClientChannel {
    return this.#getOrCreate(channelName, () => new ClientChannel(channelName));
  }

  presence(channelName: string): PresenceChannel {
    return this.#getOrCreate(
      channelName,
      () => new PresenceChannel(channelName),
    ) as PresenceChannel;
  }

  public(channelName: string): ClientChannel {
    return this.#getOrCreate(channelName, () => new ClientChannel(channelName));
  }

  #getOrCreate<T extends ClientChannel>(name: string, factory: () => T): T {
    if (!this.#channels.has(name)) {
      const ch = factory();
      this.#channels.set(name, ch);
      this.#subscribe(name);
    }
    return this.#channels.get(name) as T;
  }

  disconnect(): void {
    this.#ws?.close();
  }
}

export class ClientChannel {
  readonly #name: string;
  readonly #handlers = new Map<string, EventHandler[]>();

  constructor(name: string) {
    this.#name = name;
  }

  get name(): string {
    return this.#name;
  }

  listen(event: string, handler: EventHandler): this {
    if (!this.#handlers.has(event)) this.#handlers.set(event, []);
    const handlers = this.#handlers.get(event);
    if (handlers) handlers.push(handler);
    return this;
  }

  dispatchEvent(event: string, data: unknown): void {
    const handlers = this.#handlers.get(event);
    if (handlers) {
      for (const h of handlers) h(data);
    }
  }
}

export class PresenceChannel extends ClientChannel {
  #members: PresenceMemberData[] = [];
  readonly #hereHandlers: Array<(members: PresenceMemberData[]) => void> = [];
  readonly #joiningHandlers: Array<(member: PresenceMemberData) => void> = [];
  readonly #leavingHandlers: Array<(member: PresenceMemberData) => void> = [];

  here(handler: (members: PresenceMemberData[]) => void): this {
    this.#hereHandlers.push(handler);
    return this;
  }

  joining(handler: (member: PresenceMemberData) => void): this {
    this.#joiningHandlers.push(handler);
    return this;
  }

  leaving(handler: (member: PresenceMemberData) => void): this {
    this.#leavingHandlers.push(handler);
    return this;
  }

  dispatchPresence(type: string, msg: Record<string, unknown>): void {
    if (type === 'presence.init') {
      this.#members = msg['members'] as PresenceMemberData[];
      for (const h of this.#hereHandlers) h(this.#members);
    } else if (type === 'presence.joined') {
      const member = msg['member'] as PresenceMemberData;
      this.#members.push(member);
      for (const h of this.#joiningHandlers) h(member);
    } else if (type === 'presence.left') {
      const member = msg['member'] as PresenceMemberData;
      this.#members = this.#members.filter((m) => m['id'] !== member['id']);
      for (const h of this.#leavingHandlers) h(member);
    }
  }

  get members(): PresenceMemberData[] {
    return this.#members;
  }
}
