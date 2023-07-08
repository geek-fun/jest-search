import execa from 'execa';
import cwd from 'cwd';
import { debug } from 'console';
import { getError, isFileExists, platform, waitForLocalhost } from './utils';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import download from 'download-tarball';
import { execSync } from 'child_process';

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

  if (!(await isFileExists(binaryFilepath))) {
    await download({ url, dir: binaryLocation });
    debug(`Downloaded ${engine}`);
  } else {
    debug(`${engine} already downloaded`);
  }

  return binaryFilepath;
};

const start = async (
  options: Omit<EngineOptions, 'binaryLocation'> & { binaryFilepath: string },
) => {
  engineOptions = options;
  const { engine, version, binaryFilepath, clusterName, nodeName, port = 9200 } = options;
  debug(`Starting ${engine} ${version}`, binaryFilepath);
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
  debug(`${engine} is running`, server);
};

const cleanupIndices = (options: { indexes?: Array<string> }): void => {
  const indexes = options.indexes?.join(',');

  if (indexes) {
    const result = execSync(`curl -XDELETE http://localhost/${indexes} -s`);

    const error = getError(result);

    if (error) {
      throw new Error(`Failed to remove index: ${error.reason}`);
    }

    debug('Removed all indexes');
  }
};

const killProcess = (): void => {
  try {
    server.kill('SIGTERM', {
      forceKillAfterTimeout: 2000,
    });
  } catch (e) {
    debug(`Could not stop ES, killing all elasticsearch system wide`);
    execSync(`pkill -f Elasticsearch`);
  }
};

export const startEngine = async ({
  engine = EngineType.ELASTICSEARCH,
  version = '8.8.2',
  port = 9200,
  binaryLocation = `${cwd()}/node_modules/.cache/jest-search`,
  clusterName = 'jest-search-local',
  nodeName = 'jest-search-local',
}: EngineOptions = {}) => {
  const binaryFilepath = await prepareEngine(engine, version, binaryLocation);
  // start engine
  await start({ engine, version, port, clusterName, nodeName, binaryFilepath });
};

export const stopEngine = (): void => {
  cleanupIndices({ indexes: engineOptions.indexes });
  killProcess();

  debug('ES has been stopped');
};
