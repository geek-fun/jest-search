import { startEngine, stopEngine, EngineType, EngineOptions } from './engine';
import path from 'path';

const globalSetup = async () => {
  const configPath =
    process.env.JEST_SEARCH_CONFIG || path.resolve(process.cwd() + '/jest-search-config.js');
  const config = (await import(configPath))();
  await startEngine(config);
};
const globalTeardown = stopEngine;

export { globalSetup, globalTeardown, EngineType, EngineOptions };
