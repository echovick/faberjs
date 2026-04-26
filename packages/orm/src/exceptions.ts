export class ModelNotFoundException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelNotFoundException';
  }
}

export class DatabaseException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseException';
  }
}
