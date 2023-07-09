import execa from 'execa';
import { getError, isFileExists, platform, waitForLocalhost } from './utils';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import download from 'download-tarball';
import { execSync } from 'child_process';
import path from 'path';
import { debug } from './debug';

export enum EngineType {
  ZINC = 'zinc',
  ELASTICSEARCH = 'elasticsearch',
  OPENSEARCH = 'opensearch',
}

export type EngineOptions = {
  engine?: EngineType;
  version?: string;
  binaryLocation?: string;
  clusterName?: string;
  nodeName?: string;
  port?: number;
  indexes?: Array<string>;
};

const artifacts = {
  ES: 'https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch',
  OS: 'https://artifacts.opensearch.org/releases/bundle/opensearch',
  ZINC: 'https://github.com/zinclabs/zinc/releases/download',
};

let server: execa.ExecaChildProcess;
let engineOptions: EngineOptions;
const getEngineResourceURL = async (engine: EngineType, version: string) => {
  const { sysName, arch } = await platform();
  const engines: {
    [engineType: string]: () => string;
  } = {
    [EngineType.ELASTICSEARCH]: () =>
      parseInt(version.charAt(0)) >= 7
        ? `${artifacts.ES}-${version}-${sysName}-${arch}.tar.gz`
        : `${artifacts.ES}-${version}.tar.gz`,

    [EngineType.OPENSEARCH]: () =>
      `${artifacts.OS}/${version}/opensearch-${version}-${sysName}-${arch.slice(1, 4)}.tar.gz`,
    [EngineType.ZINC]: () =>
      `${artifacts.ZINC}/v${version}/zinc_${version}_${sysName}_${arch}.tar.gz`,
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

const start = async (
  options: Omit<EngineOptions, 'binaryLocation'> & { binaryFilepath: string }
) => {
  engineOptions = options;
  const { engine, version, binaryFilepath, clusterName, nodeName, port = 9200 } = options;
  debug(`Starting ${engine} ${version}, ${binaryFilepath}`);
  const esExecArgs = [
    '-p',
    `${binaryFilepath}/${engine}-${version}/es-pid`,
    `-Ecluster.name=${clusterName}`,
    `-Enode.name=${nodeName}`,
    `-Ehttp.port=${port}`,
    `-Expack.security.enabled=false`,
  ];

  server = execa(`${binaryFilepath}/bin/elasticsearch`, esExecArgs, { all: true });

  await waitForLocalhost(port);
  debug(`${engine} is running on port: ${port}, pid: ${server.pid}`);
};

const cleanupIndices = (options: { indexes?: Array<string> }): void => {
  const indexes = options.indexes?.join(',');

  if (indexes) {
    const result = execSync(`curl -s -X DELETE http://localhost/${indexes}`, {
      env: { http_proxy: undefined, https_proxy: undefined, all_proxy: undefined },
    });

    const error = getError(result);

    if (error) {
      throw new Error(`Failed to remove index: ${error.reason}`);
    }

    debug('Removed all indexes');
  }
};

const killProcess = async (): Promise<void> => {
  try {
    const closeEmit = new Promise((resolve) => server.on('close', () => resolve('close')));
    const timeoutEmit = new Promise((resolve) => setTimeout(() => resolve('timout'), 3000));

    server.kill('SIGTERM', { forceKillAfterTimeout: 2000 });

    const result = await Promise.race([closeEmit, timeoutEmit]);
    debug(`close result, ${result}`);
  } catch (e) {
    debug(`Could not stop ${engineOptions.engine}, killing system wide`);
  }
};

export const startEngine = async ({
  engine = EngineType.ELASTICSEARCH,
  version = '8.8.2',
  port = 9200,
  binaryLocation = path.resolve(__dirname + '/../') + '/node_modules/.cache/jest-search',
  clusterName = 'jest-search-local',
  nodeName = 'jest-search-local',
}: EngineOptions = {}) => {
  const binaryFilepath = await prepareEngine(engine, version, binaryLocation);
  // start engine
  await start({ engine, version, port, clusterName, nodeName, binaryFilepath });
};

export const stopEngine = async (): Promise<void> => {
  cleanupIndices({ indexes: engineOptions.indexes });
  await killProcess();

  debug('ES has been stopped');
};
