import http from 'http';
import { access, constants } from 'fs';
import { promisify } from 'util';
import execa from 'execa';
import { debug } from 'console';

export const waitForLocalhost = async (port: number, retries = 60) => {
  debug(`checking the local engine startup: ${retries}`);
  await new Promise((resolve, _) => setTimeout(() => resolve(0), 2000));
  if (retries <= 0) {
    throw new Error('failed start search engine');
  }
  const statusCode = await new Promise((resolve, _) =>
    http
      .get(`http://localhost:${port}`, { family: 4 }, (res) => {
        return resolve(res.statusCode);
      })
      .on('error', (e) => {
        return resolve(500);
      }),
  ).then((statusCode) => statusCode);

  if (statusCode !== 200) {
    await waitForLocalhost(port, retries - 1);
  } else {
    await new Promise((resolve, _) => setTimeout(() => resolve(0), 2000));
    debug('engine started');
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
  const { stdout: sysName } = await execa('uname', ['-o']);
  const { stdout: arch } = await execa('uname', ['-m']);

  return { sysName: sysName.toLowerCase(), arch: arch.toLowerCase() };
};

type ESError = {
  reason: string;
  type: string;
};
export const getError = (esResponse: Buffer): ESError | undefined => {
  return JSON.parse(esResponse.toString()).error;
};
