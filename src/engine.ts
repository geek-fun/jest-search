import execa from 'execa';
import { download, getError, platform, waitForLocalhost } from './utils';
import { execSync } from 'child_process';
import path from 'path';
import { debug } from './debug';
import { Artifacts, DISABLE_PROXY, EngineType } from './constants';
import { startZinc } from './zinc';

type IndexBody = { name: string; body?: unknown; mappings?: unknown };
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

const getEngineResourceURL = async (engine: EngineType, version: string) => {
  const { sysName, arch } = await platform();
  const engines: {
    [engineType: string]: () => string;
  } = {
    [EngineType.ELASTICSEARCH]: () =>
      parseInt(version.charAt(0)) >= 7
        ? `${Artifacts.ES}-${version}-${sysName}-${arch}.tar.gz`
        : `${Artifacts.ES}-${version}.tar.gz`,
    [EngineType.OPENSEARCH]: () =>
      `${Artifacts.OS}/${version}/opensearch-${version}-linux-${arch.replace('86_', '')}.tar.gz`,
    [EngineType.ZINCSEARCH]: () =>
      `${Artifacts.ZINC}/v${version}/zincsearch_${version}_${sysName}_${arch}.tar.gz`,
  };

  return engines[engine]();
};
const prepareEngine = async (engine: EngineType, version: string, binaryLocation: string) => {
  const url = await getEngineResourceURL(engine, version);

  return await download(url, binaryLocation, engine, version);
};

const createIndexes = async () => {
  const { indexes, port, engine } = engineOptions;

  const curlCommands: {
    [engineType: string]: (indexItem: IndexBody) => string;
  } = {
    [EngineType.ELASTICSEARCH]: ({ name, body }: IndexBody) =>
      `curl -XPUT "http://localhost:${port}/${name}" -H "Content-Type: application/json" -d'${JSON.stringify(
        body
      )}'`,
    [EngineType.OPENSEARCH]: ({ name, body }: IndexBody) =>
      `curl -XPUT "http://localhost:${port}/${name}" -H "Content-Type: application/json" -d'${JSON.stringify(
        body
      )}'`,
    [EngineType.ZINCSEARCH]: (index: IndexBody) =>
      `curl -XPUT "http://localhost:${port}/api/index" -u ${engineOptions.zincAdmin}:${
        engineOptions.zincPassword
      } -H "Content-Type: application/json" -d'${JSON.stringify(index)}'`,
  };
  debug('creating indexes');
  await Promise.all(
    indexes.map(async (index) => await execSync(curlCommands[engine](index), DISABLE_PROXY))
  );
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
      { all: true }
    );
  }
  server.on('error', (err) => {
    debug(`failed to start engine emit error: ${JSON.stringify(err)}`);
    throw new Error('failed to start engine emit error');
  });

  await waitForLocalhost(engine, port);
  debug(`${engine} is running on port: ${port}, pid: ${server.pid}`);
  await createIndexes();

  debug(`indexes created`);
};

const cleanupIndices = async (): Promise<void> => {
  const { engine, port, indexes, zincAdmin, zincPassword } = engineOptions;
  if (indexes.length <= 0) return;
  debug(' deleting indexes');
  const result = execSync(
    engine === EngineType.ZINCSEARCH
      ? `curl -s -X DELETE http://localhost:${port}/api/index/* -u ${zincAdmin}:${zincPassword}`
      : `curl -s -X DELETE http://localhost:${port}/${indexes.map(({ name }) => name).join(',')}`,
    DISABLE_PROXY
  );

  const error = getError(result);

  if (error) {
    throw new Error(`Failed to remove index: ${error.reason}`);
  }

  debug('Removed all indexes');
};

const killProcess = async (): Promise<void> => {
  try {
    const closeEmit = new Promise((resolve, reject) => {
      server.on('exit', (code, signal) => resolve(`exit: code:${code}, signal:${signal}`));
      server.on('error', (err) => reject(`error: ${err}`));
    });

    server.kill('SIGTERM', { forceKillAfterTimeout: 10000 });

    const result = await Promise.race([
      closeEmit,
      new Promise((resolve) => setTimeout(() => resolve('timout'), 15000)),
    ]);
    debug(`close result: ${result}`);
  } catch (e) {
    debug(`Could not stop ${engineOptions.engine},error: ${e} killing system wide`);
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
  // start engine
  await start();
};

export const stopEngine = async (): Promise<void> => {
  await cleanupIndices();
  await killProcess();

  debug('ES has been stopped');
};
