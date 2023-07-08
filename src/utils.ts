import { access, constants } from 'fs';
import { promisify } from 'util';
import execa from 'execa';
import { debug } from 'console';
import { execSync } from 'child_process';

export const waitForLocalhost = async (port: number, retries = 60) => {
  debug(`checking the local engine startup: ${retries}`);
  await new Promise((resolve, _) => setTimeout(() => resolve(0), 2000));
  if (retries <= 0) {
    throw new Error('failed start search engine');
  }
  let statusCode;
  const response = await execSync(
    'curl -s -o /dev/null -i -w "%{http_code}" "http://localhost:9200" || true',
    { env: { http_proxy: undefined, https_proxy: undefined, all_proxy: undefined } },
  );

  statusCode = parseInt(response.toString('utf-8'), 10);
  debug(`curl response: ${statusCode}`);

  if (statusCode !== 200) {
    await waitForLocalhost(port, retries - 1);
  } else {
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
