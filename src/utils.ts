import http from 'http';
import { access, constants } from 'fs';
import { promisify } from 'util';
import { execa } from 'execa';

export const waitForLocalhost = async ({
  port,
  path,
  retries = 60,
}: {
  port: number;
  path?: string;
  retries?: number;
}) => {
  let retryCount = 0;
  return new Promise((resolve) => {
    const retry = () => {
      if (retryCount === retries) {
        throw new Error('failed start search engine');
      }
      setTimeout(main, 2000);
      retryCount++;
    };

    const doRequest = (next: () => void) => {
      const request = http.request({ method: 'GET', port, path }, ({ statusCode }) => {
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
