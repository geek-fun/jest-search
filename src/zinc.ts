import execa from 'execa';
import { ConfiguredOptions, EngineType } from './engine';
import { debug } from './debug';
import { isFileExists } from './utils';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import download from 'download-tarball';

export const startZinc = ({
  binaryFilepath,
  engine,
  port,
  zincAdmin,
  zincPassword,
}: Pick<
  ConfiguredOptions,
  'binaryFilepath' | 'engine' | 'port' | 'zincAdmin' | 'zincPassword'
>) => {
  return execa(`${binaryFilepath}/${engine}`, {
    all: true,
    env: {
      ZINC_SERVER_PORT: `${port}`,
      ZINC_FIRST_ADMIN_USER: zincAdmin,
      ZINC_FIRST_ADMIN_PASSWORD: zincPassword,
      ZINC_SHARD_NUM: '1',
      ZINC_DATA_PATH: `${binaryFilepath}/data`,
    },
  });
};

export const downloadZinc = async (url: string, binaryFilepath: string) => {
  debug(`checking if binary exists: ${binaryFilepath}`);
  if (!(await isFileExists(binaryFilepath))) {
    debug(`downloading binary, url: ${url}, path: ${binaryFilepath}`);
    await download({ url, dir: binaryFilepath });
    debug(`Downloaded ${EngineType.ZINCSEARCH}`);
  } else {
    debug(`${EngineType.ZINCSEARCH} already downloaded`);
  }
};
