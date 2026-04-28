const LISTEN_FOR = '_listenFor';

export function ListenFor(EventClass: new (...args: never[]) => unknown): ClassDecorator {
  return (target) => {
    Object.defineProperty(target, LISTEN_FOR, {
      value: EventClass.name,
      writable: false,
      enumerable: false,
      configurable: false,
    });
  };
}

export function getListenFor(target: new (...args: never[]) => unknown): string | undefined {
  return (target as unknown as Record<string, unknown>)[LISTEN_FOR] as string | undefined;
}
