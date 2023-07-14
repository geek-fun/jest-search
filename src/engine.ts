import execa from 'execa';
import { getError, isFileExists, platform, waitForLocalhost } from './utils';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import download from 'download-tarball';
import { execSync } from 'child_process';
import path from 'path';
import { debug } from './debug';
import { ARTIFACTS, DISABLE_PROXY } from './constants';

export enum EngineType {
  ZINC = 'zinc',
  ELASTICSEARCH = 'elasticsearch',
  OPENSEARCH = 'opensearch',
}

export type EngineOptions = {
  engine: EngineType;
  version: string;
  binaryLocation: string;
  clusterName: string;
  nodeName: string;
  port: number;
  indexes: Array<{ name: string; body: unknown }>;
};
type ConfiguredOptions = Omit<EngineOptions, 'binaryLocation'> & { binaryFilepath: string };

let server: execa.ExecaChildProcess;
let engineOptions: ConfiguredOptions;
// 'https://artifacts.opensearch.org/releases/core/opensearch/2.8.0/opensearch-min-2.8.0-linux-x64.tar.gz'
const getEngineResourceURL = async (engine: EngineType, version: string) => {
  const { sysName, arch } = await platform();
  const engines: {
    [engineType: string]: () => string;
  } = {
    [EngineType.ELASTICSEARCH]: () =>
      parseInt(version.charAt(0)) >= 7
        ? `${ARTIFACTS.ES}-${version}-${sysName}-${arch}.tar.gz`
        : `${ARTIFACTS.ES}-${version}.tar.gz`,
    [EngineType.OPENSEARCH]: () =>
      `${ARTIFACTS.OS}/${version}/opensearch-${version}-linux-${arch.replace('86_', '')}.tar.gz`,
    [EngineType.ZINC]: () =>
      `${ARTIFACTS.ZINC}/v${version}/zinc_${version}_${sysName}_${arch}.tar.gz`,
  };

  return engines[engine]();
};
const prepareEngine = async (engine: EngineType, version: string, binaryLocation: string) => {
  const url = await getEngineResourceURL(engine, version);
  const binaryFilepath = `${binaryLocation}/${engine}-${version}`;

  debug(`checking if binary exists: ${binaryFilepath}`);
  if (!(await isFileExists(binaryFilepath))) {
    debug(`downloading binary, url: ${url}, path: ${binaryFilepath}`);
    await download({ url, dir: binaryLocation });
    debug(`Downloaded ${engine}`);
  } else {
    debug(`${engine} already downloaded`);
  }

  return binaryFilepath;
};
const createIndexes = async () => {
  const { indexes = [], port, engine } = engineOptions;

  const curlCommands: {
    [engineType: string]: (indexItem: { name: string; body: unknown }) => string;
  } = {
    [EngineType.ELASTICSEARCH]: ({ name, body }: { name: string; body: unknown }) =>
      `curl -XPUT "http://localhost:${port}/${name}" -H "Content-Type: application/json" -d'${JSON.stringify(
        body
      )}'`,
    [EngineType.OPENSEARCH]: ({ name, body }: { name: string; body: unknown }) =>
      `curl -XPUT "http://localhost:${port}/${name}" -H "Content-Type: application/json" -d'${JSON.stringify(
        body
      )}'`,
  };
  debug('creating indexes');
  await Promise.all(
    indexes.map(async (index) => await execSync(curlCommands[engine](index), DISABLE_PROXY))
  );
};

const start = async () => {
  const { engine, version, binaryFilepath, clusterName, nodeName, port } = engineOptions;
  debug(`Starting ${engine} ${version}, ${binaryFilepath}`);
  const startMatrix: { [key: string]: Array<string> } = {
    [EngineType.ELASTICSEARCH]: [
      '-p',
      `${binaryFilepath}/${engine}-${version}/server-pid`,
      `-Ecluster.name=${clusterName}`,
      `-Enode.name=${nodeName}`,
      `-Ehttp.port=${port}`,
      `-Expack.security.enabled=false`,
    ],
    [EngineType.OPENSEARCH]: [
      '-p',
      `${binaryFilepath}/${engine}-${version}/server-pid`,
      `-Ecluster.name=${clusterName}`,
      `-Enode.name=${nodeName}`,
      `-Ehttp.port=${port}`,
      `-Eplugins.security.disabled=true`,
    ],
  };
  server = execa(`${binaryFilepath}/bin/${engine}`, startMatrix[engine], { all: true });

  await waitForLocalhost(port);
  debug(`${engine} is running on port: ${port}, pid: ${server.pid}`);
  await createIndexes();

  debug(`indexes created`);
};

const cleanupIndices = async (): Promise<void> => {
  const { port, indexes } = engineOptions;
  if (indexes.length <= 0) return;
  debug(' deleting indexes');
  const result = execSync(
    `curl -s -X DELETE http://localhost:${port}/${indexes.map(({ name }) => name).join(',')}`,
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
    const closeEmit = new Promise((resolve) => server.on('close', () => resolve('close')));

    server.kill('SIGTERM', { forceKillAfterTimeout: 2000 });

    const result = await Promise.race([
      closeEmit,
      new Promise((resolve) => setTimeout(() => resolve('timout'), 3000)),
    ]);
    debug(`close result: ${result}`);
  } catch (e) {
    debug(`Could not stop ${engineOptions.engine}, killing system wide`);
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
}: Partial<EngineOptions> = {}) => {
  const binaryFilepath = await prepareEngine(engine, version, binaryLocation);
  engineOptions = { engine, version, port, clusterName, nodeName, binaryFilepath, indexes };
  // start engine
  await start();
};

export const stopEngine = async (): Promise<void> => {
  await cleanupIndices();
  await killProcess();

  debug('ES has been stopped');
};
