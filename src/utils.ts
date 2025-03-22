import * as fs from 'fs';
import { constants } from 'fs';
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
import * as yauzl from 'yauzl';

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

export const isFileExists = (path: string): boolean => {
  try {
    fs.accessSync(path, constants.F_OK);
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

const tryRecursiveDir = (filepath: string) => {
  if (!isFileExists(filepath)) {
    fs.mkdirSync(filepath, { recursive: true, mode: 0o775 });
  }
};

const pipelineAsync = promisify(pipeline);
const isZipFile = (filePath: string): boolean => {
  const buffer = Buffer.alloc(2);
  try {
    fs.openSync(filePath, 'r');
    fs.readSync(fs.openSync(filePath, 'r'), buffer, 0, 2, 0);
    return buffer.toString('hex') === '504b';
  } catch (error) {
    debug(`Error checking file signature: ${error}`);
    return false;
  }
};

const unGzip = async (readPath: string, writePath: string) => {
  // Pipe the response body to the decompression stream and then to the extract function
  await pipelineAsync(
    fs.createReadStream(readPath),
    // decompressStream,
    zlib.createGunzip(),
    extract(writePath, { dmode: 0o775, fmode: 0o775 }),
  );
};

export const download = async (url: string, dir: string, engine: EngineType, version: string) => {
  const binaryPath = `${dir}/${engine}-${version}`;
  const writePath = engine === EngineType.ZINCSEARCH ? `${binaryPath}` : `${dir}`;
  debug(`checking if binary exists: ${binaryPath}`);
  if (isFileExists(`${binaryPath}`)) {
    debug(`binary already downloaded`);

    return binaryPath;
  } else {
    tryRecursiveDir(dir);
  }

  debug(`downloading binary, url: ${url}, path: ${binaryPath}`);
  const proxyAgent = process.env.https_proxy
    ? new HttpsProxyAgent(process.env.https_proxy)
    : undefined;
  try {
    const res = await fetch(url, { agent: proxyAgent });
    if (!res.ok) throw new Error(await res.text());
    const contentType = res.headers.get('content-type') || '';
    debug(`content-type: ${contentType}`);
    if (
      ['application/gzip', 'application/x-gzip', 'application/octet-stream'].includes(contentType)
    ) {
      // Pipe the response body to the decompression stream and then to the extract function
      await pipelineAsync(
        res.body,
        // decompressStream,
        zlib.createGunzip(),
        extract(writePath, { dmode: 0o775, fmode: 0o775 }),
      );
    } else if (contentType === 'application/zip') {
      await pipelineAsync(res.body, fs.createWriteStream(`${binaryPath}.zip`));
      if (isZipFile(`${binaryPath}.zip`)) {
        await downloadZip(writePath);
      } else {
        await unGzip(`${binaryPath}.zip`, writePath);
      }
    } else {
      debug(`Unsupported content type: ${contentType}`);
      process.exit(-1);
    }
  } catch (err) {
    debug(`error when downloading and extracting the binary file: ${err}`);
    process.exit(-1);
  }

  for (let i = 0; i < 5; i++) {
    const binaryFile =
      isFileExists(`${binaryPath}/bin/${engine}`) || isFileExists(`${binaryPath}/${engine}`);

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
  debug(`getEngineBinaryURL,sysName: ${sysName}, arch: ${arch}`);
  const engines: {
    [engineType: string]: () => string;
  } = {
    [EngineType.ELASTICSEARCH]: () => {
      const archName = arch === 'arm64' ? 'aarch64' : 'x86_64';
      const systemName = sysName === 'win32' ? 'windows' : sysName;
      const zipFormat = systemName === 'windows' ? 'zip' : 'tar.gz';
      // https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-8.13.1-windows-x86_64.zip
      return parseInt(version.charAt(0)) >= 7
        ? `${Artifacts.ES}-${version}-${systemName}-${archName}.${zipFormat}`
        : `${Artifacts.ES}-${version}.${zipFormat}`;
    },
    [EngineType.OPENSEARCH]: () => {
      const systemName = sysName === 'win32' ? 'windows' : sysName;
      const zipFormat = systemName === 'windows' ? 'zip' : 'tar.gz';
      // https://artifacts.opensearch.org/releases/bundle/opensearch/2.13.0/opensearch-2.13.0-windows-x64.zip
      return `${Artifacts.OS}/${version}/opensearch-${version}-${systemName}-${arch}.${zipFormat}`;
    },

    [EngineType.ZINCSEARCH]: () => {
      const archName = arch === 'x64' ? 'x86_64' : arch;
      const systemName = sysName === 'win32' ? 'windows' : sysName;
      // https://github.com/zincsearch/zincsearch/releases/download/v0.4.10/zincsearch_0.4.10_windows_x86_64.tar.gz
      return `${Artifacts.ZINC}/v${version}/zincsearch_${version}_${systemName}_${archName}.tar.gz`;
    },
  };

  return engines[engine]();
};

const downloadZip = async (zipFilePath: string) => {
  try {
    return new Promise((resolve, reject) => {
      yauzl.open(zipFilePath, { lazyEntries: true }, (err, zipfile) => {
        if (err) {
          debug(`error while unzip: ${zipFilePath}`);
          return reject(err);
        }
        zipfile.readEntry();

        zipfile.on('entry', async (entry) => {
          debug(`found entry: filePath: ${entry.filePath} fileName: ${entry.fileName}`);
          if (/\/$/.test(entry.fileName)) {
            zipfile.readEntry();
          } else {
            zipfile.openReadStream(entry, (err, readStream) => {
              if (err) {
                debug(`error while unzip: ${zipFilePath}`);
                return reject(err);
              }
              readStream.on('end', zipfile.readEntry);
              tryRecursiveDir(zipFilePath);
              readStream.pipe(fs.createWriteStream(`${zipFilePath}/${entry.fileName}`));
            });
          }
        });
        zipfile.on('close', resolve);
        zipfile.on('error', reject);
      });
    });
  } catch (err) {
    debug(`error encountered while downloaidng & extract zip file: ${zipFilePath}, err: ${err}`);
    throw err;
  }
};
