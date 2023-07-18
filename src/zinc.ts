import execa from 'execa';
import { ConfiguredOptions } from './engine';
import { debug } from './debug';

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
  const zincserver = execa(`${binaryFilepath}/${engine}`, {
    all: true,
    env: {
      ZINC_SERVER_PORT: `${port}`,
      ZINC_FIRST_ADMIN_USER: zincAdmin,
      ZINC_FIRST_ADMIN_PASSWORD: zincPassword,
      ZINC_SHARD_NUM: '1',
      ZINC_DATA_PATH: `${binaryFilepath}/data`,
    },
  });
  zincserver.on('error', (error) => {
    debug(`Error starting ${engine}: ${error})}`);
  });
  return zincserver;
};
