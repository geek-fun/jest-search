import { getEngineBinaryURL } from '../src/utils';
import { EngineType } from '../src';

const mockedPlatform = jest.fn();
const mockedArch = jest.fn();

jest.mock('os', () => ({
  ...jest.requireActual('os'),
  platform: () => mockedPlatform(),
  arch: () => mockedArch(),
}));

const platforms = [
  {
    engine: EngineType.ELASTICSEARCH,
    version: '8.9.0',
    platform: 'darwin',
    arch: 'x64',
    URL: 'https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-8.9.0-darwin-x86_64.tar.gz',
  },
  {
    engine: EngineType.ELASTICSEARCH,
    version: '8.9.0',
    platform: 'darwin',
    arch: 'arm64',
    URL: 'https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-8.9.0-darwin-aarch64.tar.gz',
  },
  {
    engine: EngineType.ELASTICSEARCH,
    version: '8.9.0',
    platform: 'linux',
    arch: 'x64',
    URL: 'https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-8.9.0-linux-x86_64.tar.gz',
  },
  {
    engine: EngineType.ELASTICSEARCH,
    version: '8.9.0',
    platform: 'linux',
    arch: 'arm64',
    URL: 'https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-8.9.0-linux-aarch64.tar.gz',
  },
  {
    engine: EngineType.ELASTICSEARCH,
    version: '6.8.23',
    platform: 'darwin',
    arch: 'x64',
    URL: 'https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-6.8.23.tar.gz',
  },
  {
    engine: EngineType.ELASTICSEARCH,
    version: '8.9.0',
    platform: 'linux',
    arch: 'arm64',
    URL: 'https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-8.9.0-linux-aarch64.tar.gz',
  },
  {
    engine: EngineType.OPENSEARCH,
    version: '2.9.0',
    platform: 'darwin',
    arch: 'x64',
    URL: 'https://artifacts.opensearch.org/releases/bundle/opensearch/2.9.0/opensearch-2.9.0-linux-x64.tar.gz',
  },
  {
    engine: EngineType.OPENSEARCH,
    version: '2.9.0',
    platform: 'linux',
    arch: 'arm64',
    URL: 'https://artifacts.opensearch.org/releases/bundle/opensearch/2.9.0/opensearch-2.9.0-linux-arm64.tar.gz',
  },
  {
    engine: EngineType.ZINCSEARCH,
    version: '0.4.7',
    platform: 'darwin',
    arch: 'x64',
    URL: 'https://github.com/zincsearch/zincsearch/releases/download/v0.4.7/zincsearch_0.4.7_darwin_x86_64.tar.gz',
  },
  {
    engine: EngineType.ZINCSEARCH,
    version: '0.4.7',
    platform: 'linux',
    arch: 'arm64',
    URL: 'https://github.com/zincsearch/zincsearch/releases/download/v0.4.7/zincsearch_0.4.7_linux_arm64.tar.gz',
  },
];

describe('unit test for utils', () => {
  describe('unit test for getEngineBinaryURL', () => {
    platforms.forEach(({ engine, version, platform, arch, URL }) => {
      it(`should return ${engine} ${version} ${platform} ${arch} download location`, () => {
        mockedPlatform.mockReturnValue(platform);
        mockedArch.mockReturnValue(arch);

        const binaryURL = getEngineBinaryURL(engine, version);
        expect(binaryURL).toEqual(URL);
      });
    });
  });
});
