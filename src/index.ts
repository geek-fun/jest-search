import { startEngine, stopEngine, EngineType, EngineOptions } from './engine';
import path from 'path';
import { debug } from './debug';

const globalSetup = async () => {
  const configPath =
    process.env.JEST_SEARCH_CONFIG || path.resolve(process.cwd() + '/jest-search-config.js');
  debug(`configPath: ${configPath}, cwdPath: ${process.cwd()}`);
  try {
    const configFn = await import(configPath);
    debug(`configFn: ${configFn}`);
    const config = configFn();
    debug(`final config: ${config}`);
    await startEngine(config);
  } catch (err) {
    debug(`error caught: ${err}`);
    throw err;
  }
};
const globalTeardown = stopEngine;

export { globalSetup, globalTeardown, EngineType, EngineOptions };
