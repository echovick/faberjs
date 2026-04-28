import { Injectable } from '@faber-js/core';
import type { SocketContract } from './types';

@Injectable()
export abstract class Channel {
  async handle(_socket: SocketContract): Promise<void> {
    // Default no-op; subclasses override with typed handler methods
  }
}
