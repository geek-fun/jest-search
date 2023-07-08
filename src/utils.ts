import http from 'http';
import fs, { access, constants } from 'fs';
import https from 'https';
import { debug } from 'console';
import { promisify } from 'util';
import { execa } from 'execa';

export const waitForLocalhost = async (port: number, path?: string, useGet?: boolean) => {
  return new Promise((resolve) => {
    const retry = () => {
      setTimeout(main, 200);
    };

    const method = useGet ? 'GET' : 'HEAD';

    const doRequest = (next: () => void) => {
      const request = http.request({ method, port, path }, ({ statusCode }) => {
        if (statusCode === 200) {
          resolve({ statusCode });
          return;
        }

        next();
      });

      request.on('error', next);
      request.end();
    };

    const main = () => {
      doRequest(() => retry());
    };

    main();
  });
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

export const platform = async () => ({
  sysName: String(await execa('uname', ['-o'])).toLowerCase(),
  arch: String(await execa('uname', ['-m'])).toLowerCase(),
});
