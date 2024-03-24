import * as fs from 'fs';
import { access, constants } from 'fs';
import { promisify } from 'util';
import { debug } from './debug';
import { Artifacts, EngineType } from './constants';
import fetch from 'node-fetch';
import { EngineClient } from './engineClient';
import { HttpsProxyAgent } from 'https-proxy-agent';
import * as os from 'os';
import * as zlib from 'zlib';
import { extract } from 'tar-fs';
import { pipeline } from 'node:stream';

export const waitForLocalhost = async (engineClient: EngineClient, retries = 30) => {
  await new Promise((resolve) => setTimeout(() => resolve(0), 2000));
  if (retries <= 0) {
    throw new Error('failed start search engine');
  }
  const statusCode = await engineClient.heartbeat();
  debug(`heartbeat: ${statusCode}, retries left: ${retries}`);

  if (statusCode !== 200) {
    await waitForLocalhost(engineClient, retries - 1);
  }
};

export const isFileExists = async (path: string): Promise<boolean> => {
  const fsAccessPromisified = promisify(access);

  try {
    await fsAccessPromisified(path, constants.F_OK);
    return true;
  } catch (e) {
    return false;
  }
};

const platform = () => {
  const arch = os.arch().toString();
  const sysName = os.platform().toString();
  debug(`checking platform uname: ${sysName} ${arch}`);
  return { sysName: sysName.toLowerCase(), arch: arch.toLowerCase() };
};

const pipelineAsync = promisify(pipeline);

export const download = async (url: string, dir: string, engine: EngineType, version: string) => {
  const binaryPath = `${dir}/${engine}-${version}`;
  const writePath = engine === EngineType.ZINCSEARCH ? `${binaryPath}` : `${dir}`;
  debug(`checking if binary exists: ${binaryPath}`);
  if (await isFileExists(`${binaryPath}`)) {
    debug(`binary already downloaded`);

    return binaryPath;
  } else {
    fs.mkdirSync(dir, { recursive: true, mode: 0o775 });
  }

  debug(`downloading binary, url: ${url}, path: ${binaryPath}`);
  const proxyAgent = process.env.https_proxy
    ? new HttpsProxyAgent(process.env.https_proxy)
    : undefined;
  try {
    const res = await fetch(url, { agent: proxyAgent });

    const contentType = res.headers.get('content-type') || '';
    debug(`content-type: ${contentType}`);
    let decompressStream;
    if (
      ['application/gzip', 'application/x-gzip', 'application/octet-stream'].includes(contentType)
    ) {
      decompressStream = zlib.createGunzip();
    } else if (contentType === 'application/zip') {
      decompressStream = zlib.createUnzip();
    } else {
      debug(`Unsupported content type: ${contentType}`);
      process.exit(-1);
    }

    // Pipe the response body to the decompression stream and then to the extract function
    await pipelineAsync(
      res.body,
      decompressStream,
      extract(writePath, { dmode: 0o775, fmode: 0o775 }),
    );
  } catch (err) {
    debug(`error when downloading and extracting the binary file: ${err}`);
    process.exit(-1);
  }

  for (let i = 0; i < 5; i++) {
    const binaryFile =
      (await isFileExists(`${binaryPath}/bin/${engine}`)) ||
      (await isFileExists(`${binaryPath}/${engine}`));

    await new Promise((resolve) => setTimeout(() => resolve(0), 2000));
    if (binaryFile) {
      debug(`Downloaded ${binaryPath}`);
      return binaryPath;
    }
  }
  throw new Error(
    `failed to download binary, please delete the folder ${binaryPath} and try again`,
  );
};

export const getEngineBinaryURL = (engine: EngineType, version: string) => {
  const { sysName, arch } = platform();
  const engines: {
    [engineType: string]: () => string;
  } = {
    [EngineType.ELASTICSEARCH]: () => {
      const archName = arch === 'arm64' ? 'aarch64' : 'x86_64';
      return parseInt(version.charAt(0)) >= 7
        ? `${Artifacts.ES}-${version}-${sysName}-${archName}.tar.gz`
        : `${Artifacts.ES}-${version}.tar.gz`;
    },
    [EngineType.OPENSEARCH]: () =>
      `${Artifacts.OS}/${version}/opensearch-${version}-linux-${arch}.tar.gz`,

    [EngineType.ZINCSEARCH]: () => {
      const archName = arch === 'x64' ? 'x86_64' : arch;
      return `${Artifacts.ZINC}/v${version}/zincsearch_${version}_${sysName}_${archName}.tar.gz`;
    },
  };

  return engines[engine]();
};
