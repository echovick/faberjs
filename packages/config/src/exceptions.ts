export class ConfigNotInitializedException extends Error {
  constructor() {
    super(
      'Config repository has not been initialized. ' +
        'Call setConfigRepository() before using the config() helper.',
    );
    this.name = 'ConfigNotInitializedException';
  }
}
