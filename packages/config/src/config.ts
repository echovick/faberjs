import { ConfigNotInitializedException } from './exceptions';
import type { ConfigRepositoryContract } from './types';

let repository: ConfigRepositoryContract | null = null;

export function setConfigRepository(repo: ConfigRepositoryContract): void {
  repository = repo;
}

export function getConfigRepository(): ConfigRepositoryContract {
  if (repository === null) {
    throw new ConfigNotInitializedException();
  }
  return repository;
}

export function clearConfigRepository(): void {
  repository = null;
}

export function config<T = unknown>(key: string, fallback?: T): T | undefined {
  return getConfigRepository().get<T>(key, fallback);
}
