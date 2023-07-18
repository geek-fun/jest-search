import { EngineOptions, startEngine, stopEngine } from './engine';
import { EngineType } from './constants';
import path from 'path';
import { debug } from './debug';
import * as fs from 'fs';

const globalSetup = async () => {
  const configPath =
    process.env.JEST_SEARCH_CONFIG || path.resolve(process.cwd() + '/jest-search-config.js');
  if (!fs.existsSync(configPath)) {
    const errMsg = `config file doesn't exist! path:${configPath}`;
    debug(errMsg);
    throw new Error(errMsg);
  }

  debug(`importing config config: ${configPath}`);

  await startEngine((await import(configPath)).default());
};

const globalTeardown = stopEngine;

export { globalSetup, globalTeardown, startEngine, stopEngine, EngineType, EngineOptions };
