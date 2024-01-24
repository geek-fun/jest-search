import execa from 'execa';
import { download, getEngineBinaryURL, waitForLocalhost } from './utils';
import { execSync } from 'child_process';
import path from 'path';
import { debug } from './debug';
import { EngineType } from './constants';
import { startZinc } from './zinc';
import { createClient, EngineClient } from './engineClient';

export type IndexBody = { name: string; body?: unknown; mappings?: unknown };
export type EngineOptions = {
  engine: EngineType;
  version: string;
  binaryLocation: string;
  clusterName: string;
  nodeName: string;
  port: number;
  zincAdmin: string;
  zincPassword: string;
  indexes: Array<IndexBody>;
};
export type ConfiguredOptions = Omit<EngineOptions, 'binaryLocation'> & { binaryFilepath: string };

let server: execa.ExecaChildProcess;
let engineOptions: ConfiguredOptions;
let engineClient: EngineClient;

const prepareEngine = async (engine: EngineType, version: string, binaryLocation: string) => {
  const url = getEngineBinaryURL(engine, version);

  return await download(url, binaryLocation, engine, version);
};

const createIndexes = async () => {
  const { indexes } = engineOptions;
  await Promise.all(indexes.map(async (index) => await engineClient.createIndex(index)));
};

const start = async () => {
  const { engine, version, binaryFilepath, clusterName, nodeName, port } = engineOptions;
  debug(`Starting ${engine} ${version}, ${binaryFilepath}`);
  if (engine === EngineType.ZINCSEARCH) {
    server = startZinc(engineOptions);
  } else {
    server = execa(
      `${binaryFilepath}/bin/${engine}`,
      [
        '-p',
        `${binaryFilepath}/server-pid`,
        `-Ecluster.name=${clusterName}`,
        `-Enode.name=${nodeName}`,
        `-Ehttp.port=${port}`,
        engine === EngineType.OPENSEARCH
          ? `-Eplugins.security.disabled=true`
          : `-Expack.security.enabled=false`,
      ],
      { all: true },
    );
  }
  server.on('error', (err) => {
    debug(`failed to start engine emit error: ${JSON.stringify(err)}`);
    throw new Error('failed to start engine emit error');
  });
  debug(`checking the local ${engine}:${port} startup`);
  try {
    await waitForLocalhost(engineClient);
  } catch (error) {
    await killProcess();
    throw error;
  }

  debug(`${engine} is running on port: ${port}, pid: ${server.pid}`);
  await createIndexes();

  debug(`indexes created`);
};

const cleanupIndices = async (): Promise<void> => {
  const { indexes } = engineOptions;
  debug(' deleting indexes');

  await Promise.all(indexes.map(async (index) => await engineClient.deleteIndex(index)));

  debug('Removed all indexes');
};

const killProcess = async (): Promise<void> => {
  try {
    server.kill('SIGTERM', { forceKillAfterTimeout: 10000 });

    for (let i = 0; i < 50; i++) {
      if (server.killed && server.exitCode !== null) {
        return;
      }
      await new Promise((resolve) => setTimeout(() => resolve(0), 1000));
    }
  } catch (e) {
    debug(`Could not stop ${engineOptions.engine},error: ${e} killing system wide`);
    execSync(`pkill -f ${engineOptions.engine}`);
    await new Promise((resolve) => setTimeout(() => resolve(0), 5000));
  }
};

export const startEngine = async ({
  engine = EngineType.ELASTICSEARCH,
  version = '8.8.2',
  port = 9200,
  binaryLocation = path.resolve(process.cwd() + '/node_modules/.cache/jest-search'),
  clusterName = 'jest-search-local',
  nodeName = 'jest-search-local',
  indexes = [],
  zincAdmin = 'admin',
  zincPassword = 'Complexpass#123',
}: Partial<EngineOptions> = {}) => {
  const binaryFilepath = await prepareEngine(engine, version, binaryLocation);
  engineOptions = {
    engine,
    version,
    port,
    clusterName,
    nodeName,
    binaryFilepath,
    indexes,
    zincAdmin,
    zincPassword,
  };
  const authorization =
    zincAdmin && zincPassword
      ? `Basic ${Buffer.from(zincAdmin + ':' + zincPassword).toString('base64')}`
      : undefined;

  engineClient = createClient(port, engine, authorization);

  // start engine
  await start();
};

export const stopEngine = async (): Promise<void> => {
  await cleanupIndices();
  await killProcess();

  debug('ES has been stopped');
};
