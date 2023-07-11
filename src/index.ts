import { startEngine, stopEngine, EngineType, EngineOptions } from './engine';
import path from 'path';

const globalSetup = async () => {
  const configPath =
    process.env.JEST_ELASTICSEARCH_CONFIG || path.resolve(__dirname + '/../jest-search-config.js');
  const config = (await import(configPath))();
  await startEngine(config);
};
const globalTeardown = stopEngine;

export { globalSetup, globalTeardown, EngineType, EngineOptions };
