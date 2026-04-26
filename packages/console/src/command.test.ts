import { describe, expect, it, vi } from 'vitest';
import { Command } from './command';

class TestCommand extends Command {
  readonly signature = 'test:run';
  readonly description = 'A test command';

  async handle(): Promise<void> {
    this.info('hello');
  }
}

describe('Command', () => {
  it('info() writes to stdout', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    new TestCommand().info('test message');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('test message'));
    spy.mockRestore();
  });

  it('success() writes to stdout', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    new TestCommand().success('it worked');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('it worked'));
    spy.mockRestore();
  });

  it('error() writes to stderr', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    new TestCommand().error('something broke');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('something broke'));
    spy.mockRestore();
  });

  it('warn() writes to stdout', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    new TestCommand().warn('careful');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('careful'));
    spy.mockRestore();
  });

  it('line() writes to stdout', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    new TestCommand().line('a line');
    expect(spy).toHaveBeenCalledWith('a line\n');
    spy.mockRestore();
  });

  it('line() writes empty line when no argument given', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    new TestCommand().line();
    expect(spy).toHaveBeenCalledWith('\n');
    spy.mockRestore();
  });

  it('exposes signature and description', () => {
    const cmd = new TestCommand();
    expect(cmd.signature).toBe('test:run');
    expect(cmd.description).toBe('A test command');
  });
});
