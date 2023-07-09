import { startEngine, stopEngine, EngineType, EngineOptions } from './engine';

const globalSetup = startEngine;
const globalTeardown = stopEngine;

export { globalSetup, globalTeardown, EngineType, EngineOptions };
