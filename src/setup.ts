import {execa} from "execa";
import {access, constants} from 'fs';
import cwd from 'cwd';
import {promisify} from 'util';
import {debug} from "console";

const isFileExists = (path: string): Promise<boolean> => {
  const fsAccessPromisified = promisify(access);

  try {
    await fsAccessPromisified(path, constants.F_OK);

    return true;
  } catch (e) {
    return false;
  }
}

const startEngine= ({
  version,
  binaryLocation = `${cwd()}/node_modules/.cache/jest-elasticsearch`,
  port = 9200,
  indexes = [],
}: {
  version: string;
  binaryLocation:string;
  clusterName:string;
    nodeName : string;
    port:number;
    indexes:Array<string>;
}) => {
      const sysname = await execa('uname', ['-o']);
      const machine = await execa('uname', ['-m']);
    const downLoadURL = `https://github.com/zinclabs/zinc/releases/download/v${version}/zinc_${version}_${sysname}_${machine}.tar.gz`;
  const binaryFilepath = `${binaryLocation}/zinc`;

  if (!await isFileExists(binaryFilepath)) {
    await download({url: downLoadURL, dir: binaryFilepath});
    debug('Downloaded zinc');
  } else {
    debug('zinc already downloaded');
  }

  debug('Starting zinc', binaryFilepath);

  const server = execa(
    binaryFilepath,
   ,
    {env: {
      ZINC_SERVER_PORT: port,
      ZINC_TELEMETRY: false,
    }}
  );
  await waitForLocalhost({port});
  debug('Zinc is running');
}


export default const start = () => {
  // start zinc
  startEgin()
}


