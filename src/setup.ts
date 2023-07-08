import { execa } from 'execa';
import cwd from 'cwd';
import { debug } from 'console';
import { isFileExists, platform, waitForLocalhost } from './utils';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import download from 'download-tarball';

export enum EngineType {
  ZINC = 'zinc',
  ELASTICSEARCH = 'elasticsearch',
  OPENSEARCH = 'opensearch',
}

export type StartOptions = {
  engine: EngineType;
  version: string;
  binaryLocation: string;
  clusterName: string;
  nodeName: string;
  port: number;
  indexes: Array<string>;
};
const artifacts = {
  ES: 'https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch',
  OS: 'https://artifacts.opensearch.org/releases/bundle/opensearch',
  ZINC: 'https://github.com/zinclabs/zinc/releases/download',
};
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
  const downLoadURL = await getEngineResourceURL(engine, version);
  const binaryFilepath = `${binaryLocation}/${engine}/${version}`;

  if (!(await isFileExists(binaryFilepath))) {
    await download(downLoadURL, binaryFilepath);
    debug('Downloaded zinc');
  } else {
    debug('zinc already downloaded');
  }
  return binaryFilepath;
};

const startEngine = async ({
  engine,
  version,
  binaryFilepath,
  port = 9200,
  clusterName,
  nodeName,
}: StartOptions & { binaryFilepath: string }) => {
  debug(`Starting ${engine} ${version}`, binaryFilepath);
  const execArgs = [
    '-p',
    `${binaryFilepath}/elasticsearch-${version}/es-pid`,
    `-Ecluster.name=${clusterName}`,
    `-Enode.name=${nodeName}`,
    `-Ehttp.port=${port}`,
  ];

  const server = await execa(binaryFilepath, execArgs);

  await waitForLocalhost({ port });
  debug(`${engine} is running`, server);
};

export const start = async (startOptions: StartOptions) => {
  const {
    engine = EngineType.ELASTICSEARCH,
    version = '8.8.2',
    binaryLocation = `${cwd()}/node_modules/.cache/jest-search`,
  } = startOptions;

  const binaryFilepath = await prepareEngine(engine, version, binaryLocation);
  // start engine
  await startEngine({ ...startOptions, binaryFilepath });
};
