import { access, constants } from 'fs';
import { promisify } from 'util';
import execa from 'execa';
import { execSync } from 'child_process';
import { debug } from './debug';
import { DISABLE_PROXY, EngineType } from './constants';
import { extract } from 'tar-fs';
import gunzipMaybe from 'gunzip-maybe';
import fetch from 'node-fetch';
import { pipeline } from 'stream';

export const waitForLocalhost = async (engine: EngineType, port: number, retries = 60) => {
  debug(`checking the local ${engine}:${port} startup: ${retries}`);
  await new Promise((resolve) => setTimeout(() => resolve(0), 2000));
  if (retries <= 0) {
    throw new Error('failed start search engine');
  }

  const response = execSync(
    engine === EngineType.ZINCSEARCH
      ? `curl -s -o /dev/null -i -w "%{http_code}" "http://localhost:${port}/es/" || true`
      : `curl -s -o /dev/null -i -w "%{http_code}" "http://localhost:${port}" || true`,
    DISABLE_PROXY
  );

  const statusCode = parseInt(response.toString('utf-8'), 10);
  debug(`curl response: ${statusCode}`);

  if (statusCode !== 200) {
    await waitForLocalhost(engine, port, retries - 1);
  } else {
    debug(`engine ${engine}:${port} started`);
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

export const platform = async () => {
  const { stdout: sysName } = await execa('uname', ['-s']);
  const { stdout: arch } = await execa('uname', ['-m']);
  debug(`checking platform uname: ${sysName} ${arch}`);
  return { sysName: sysName.toLowerCase(), arch: arch.toLowerCase() };
};

type ESError = {
  reason: string;
  type: string;
};

export const getError = (esResponse: Buffer): ESError | undefined => {
  return JSON.parse(esResponse.toString()).error;
};

export const download = async (url: string, dir: string, engine: EngineType, version: string) => {
  const binaryPath = `${dir}/${engine}-${version}`;
  debug(`checking if binary exists: ${binaryPath}`);
  if (await isFileExists(`${binaryPath}`)) {
    debug(`binary already downloaded: ${binaryPath}`);

    return binaryPath;
  }

  debug(`downloading binary, url: ${url}, path: ${binaryPath}`);
  const res = await fetch(url);
  await new Promise((resolve, reject) =>
    pipeline(
      res.body,
      gunzipMaybe(),
      extract(engine === EngineType.ZINCSEARCH ? `${binaryPath}` : `${dir}`),
      (err) => (err ? reject(err) : resolve(''))
    )
  );
  debug(`Downloaded ${binaryPath}`);

  return binaryPath;
};
