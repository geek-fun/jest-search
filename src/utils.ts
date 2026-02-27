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
import * as path from 'path';

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
  } catch {
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
    // Mode 0o755 controls directory permissions on Unix-like systems; on Windows it is ignored but does not cause errors
    fs.mkdirSync(filepath, { recursive: true, mode: 0o755 });
  }
};

const pipelineAsync = promisify(pipeline);
export const isZipFile = (filePath: string): boolean => {
  const buffer = Buffer.alloc(2);
  let fd: number | undefined;
  try {
    fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 2, 0);
    return buffer.toString('hex') === '504b';
  } catch (error) {
    debug(`Error checking file signature: ${error}`);
    return false;
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        // ignore close errors
      }
    }
  }
};

const unGzip = async (readPath: string, writePath: string) => {
  // Pipe the response body to the decompression stream and then to the extract function
  await pipelineAsync(
    fs.createReadStream(readPath),
    zlib.createGunzip(),
    extract(writePath, { dmode: 0o755, fmode: 0o755 }),
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
    if (!res.ok) {
      const bodyText = await res.text();
      throw new Error(
        `Request to ${url} failed with status ${res.status} ${res.statusText}: ${bodyText}`,
      );
    }
    const contentType = res.headers.get('content-type') || '';
    debug(`content-type: ${contentType}`);
    if (
      ['application/gzip', 'application/x-gzip', 'application/octet-stream'].includes(contentType)
    ) {
      // Pipe the response body to the decompression stream and then to the extract function
      await pipelineAsync(
        res.body,
        zlib.createGunzip(),
        extract(writePath, { dmode: 0o755, fmode: 0o755 }),
      );
    } else if (contentType === 'application/zip') {
      await pipelineAsync(res.body, fs.createWriteStream(`${binaryPath}.zip`));
      if (isZipFile(`${binaryPath}.zip`)) {
        await downloadZip(`${binaryPath}.zip`, writePath);
      } else {
        // File has .zip extension but is actually gzipped, rename it
        const gzPath = `${binaryPath}.gz`;
        fs.renameSync(`${binaryPath}.zip`, gzPath);
        await unGzip(gzPath, writePath);
      }
    } else {
      throw new Error(`Unsupported content type: ${contentType}`);
    }
  } catch (err) {
    debug(`error when downloading and extracting the binary file: ${err}`);
    throw err;
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
      // OpenSearch only provides Windows and Linux builds. For macOS (darwin) and other
      // non-Windows platforms, use the Linux build which works on those systems.
      const systemName = sysName === 'win32' ? 'windows' : 'linux';
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

export const downloadZip = async (zipFilePath: string, extractPath: string) => {
  try {
    return new Promise<void>((resolve, reject) => {
      yauzl.open(
        zipFilePath,
        { lazyEntries: true },
        (err: Error | null, zipfile: yauzl.ZipFile) => {
          if (err) {
            debug(`error while unzip: ${zipFilePath}`);
            return reject(err);
          }

          let settled = false;
          const cleanup = (error?: Error) => {
            if (settled) return;
            settled = true;

            try {
              zipfile.close();
            } catch {
              // ignore close errors
            }
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          };

          zipfile.readEntry();

          zipfile.on('entry', (entry: yauzl.Entry) => {
            debug(`found entry: fileName: ${entry.fileName}`);
            if (/\/$/.test(entry.fileName)) {
              // Directory entry, just read next
              zipfile.readEntry();
            } else {
              // File entry
              zipfile.openReadStream(
                entry,
                (err: Error | null, readStream: NodeJS.ReadableStream) => {
                  if (err) {
                    debug(`error while opening read stream: ${err}`);
                    return cleanup(err);
                  }
                  // Security check: ensure the file path is within the extract directory
                  const resolvedExtractPath = path.resolve(extractPath);
                  const resolvedFilePath = path.resolve(extractPath, entry.fileName);

                  if (!resolvedFilePath.startsWith(resolvedExtractPath + path.sep)) {
                    debug(`Path traversal attempt detected: ${entry.fileName}`);
                    return cleanup(new Error(`Path traversal attempt detected: ${entry.fileName}`));
                  }

                  const fileDir = path.dirname(resolvedFilePath);
                  tryRecursiveDir(fileDir);
                  // On Windows, mode option is ignored but doesn't cause errors
                  const writeStream = fs.createWriteStream(resolvedFilePath, { mode: 0o755 });

                  writeStream.on('error', (err: Error) => {
                    debug(`error while writing file: ${err}`);
                    cleanup(err);
                  });

                  readStream.on('end', () => {
                    zipfile.readEntry();
                  });

                  readStream.on('error', (err: Error) => {
                    debug(`error while reading stream: ${err}`);
                    cleanup(err);
                  });

                  readStream.pipe(writeStream);
                },
              );
            }
          });
          zipfile.on('close', () => cleanup());
          zipfile.on('error', (err: Error) => {
            cleanup(err);
          });
        },
      );
    });
  } catch (err) {
    debug(`error encountered while downloading & extract zip file: ${zipFilePath}, err: ${err}`);
    throw err;
  }
};
