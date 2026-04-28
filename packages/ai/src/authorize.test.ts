import { describe, expect, it, vi, afterEach } from 'vitest';
import { Application } from '@faber-js/core';
import { ForbiddenException } from '@faber-js/http';
import { runWithRequest, Request } from '@faber-js/http';
import { Authorize } from './authorize';

function makeRequest(user: { id: number; [key: string]: unknown } | null = null): Request {
  const req = new Request({ method: 'GET', path: '/' });
  req.user = user;
  return req;
}

describe('Authorize()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should allow execution when gate is not bound', async () => {
    new Application();
    const result: string[] = [];

    class MyService {
      @Authorize('edit')
      async doThing(): Promise<string> {
        result.push('executed');
        return 'ok';
      }
    }

    await new MyService().doThing();
    expect(result).toContain('executed');
  });

  it('should allow execution when gate returns true', async () => {
    const app = new Application();
    app.instance('gate', { allows: vi.fn().mockResolvedValue(true) });

    const result: string[] = [];

    class MyService {
      @Authorize('edit')
      async doThing(): Promise<string> {
        result.push('executed');
        return 'ok';
      }
    }

    const req = makeRequest({ id: 1 });
    await runWithRequest(req, () => new MyService().doThing());
    expect(result).toContain('executed');
  });

  it('should throw ForbiddenException when gate returns false', async () => {
    const app = new Application();
    app.instance('gate', { allows: vi.fn().mockResolvedValue(false) });

    class MyService {
      @Authorize('delete')
      async deleteItem(): Promise<void> {
        // should not reach here
      }
    }

    const req = makeRequest({ id: 1 });
    await expect(runWithRequest(req, () => new MyService().deleteItem())).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should pass resource extracted by callback to gate', async () => {
    const app = new Application();
    const gateMock = { allows: vi.fn().mockResolvedValue(true) };
    app.instance('gate', gateMock);

    class MyService {
      @Authorize('update', (args) => args[0])
      async updateOrder(orderId: string): Promise<string> {
        return orderId;
      }
    }

    const req = makeRequest({ id: 42 });
    await runWithRequest(req, () => new MyService().updateOrder('order-123'));

    expect(gateMock.allows).toHaveBeenCalledWith('update', { id: 42 }, 'order-123');
  });
});
