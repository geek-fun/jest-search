import { EngineType, startEngine, stopEngine } from '../src/engine';
import { execSync } from 'child_process';
import { DISABLE_PROXY } from '../src/constants';

const indexes = [
  {
    name: 'books',
    body: {
      settings: {
        number_of_shards: '1',
        number_of_replicas: '1',
      },
      mappings: {
        properties: {
          name: {
            type: 'text',
          },
          author: {
            type: 'keyword',
          },
        },
      },
    },
  },
];

describe(`unit test for default config`, () => {
  it(`should start engine with default config`, async () => {
    await startEngine();
    const response = await execSync('curl -s "http://localhost:9200/?pretty"', {
      env: { http_proxy: undefined, https_proxy: undefined, all_proxy: undefined },
    });

    await stopEngine();

    expect(JSON.parse(response.toString())).toMatchObject({
      name: 'jest-search-local',
      cluster_name: 'jest-search-local',
      version: {
        number: '8.8.2',
        build_flavor: 'default',
        build_type: 'tar',
        build_snapshot: false,
        lucene_version: '9.6.0',
        minimum_wire_compatibility_version: '7.17.0',
        minimum_index_compatibility_version: '7.0.0',
      },
      tagline: 'You Know, for Search',
    });
  });

  it('should start engine and create index when passing indexes', async () => {
    await startEngine({ indexes: [indexes[0]] });

    const response = await execSync(
      'curl -s "http://localhost:9200/books/_mapping?pretty"',
      DISABLE_PROXY
    );

    await stopEngine();

    expect(JSON.parse(response.toString())).toEqual({
      books: {
        mappings: { properties: { author: { type: 'keyword' }, name: { type: 'text' } } },
      },
    });
  });
});

[
  { engine: EngineType.ELASTICSEARCH, version: '8.8.2', indexes: indexes },
  { engine: EngineType.OPENSEARCH, version: '2.8.0', indexes: indexes },
  // { engine: EngineType.ZINC, version: '1.0.0', indexes: indexes },
].forEach(({ engine, version, indexes }) => {
  describe(`unit test for ${engine}`, () => {
    it(`should start ${engine}-${version} and create index`, async () => {
      await startEngine({ engine, version, indexes });

      const inspect = await execSync('curl -s "http://localhost:9200/?pretty"', {
        env: { http_proxy: undefined, https_proxy: undefined, all_proxy: undefined },
      });
      const mapping = await execSync(
        'curl -s "http://localhost:9200/books/_mapping?pretty"',
        DISABLE_PROXY
      );

      await stopEngine();

      expect(JSON.parse(inspect.toString())).toMatchObject({
        name: 'jest-search-local',
        cluster_name: 'jest-search-local',
        version: {
          number: version,
          build_type: 'tar',
          build_snapshot: false,
          lucene_version: '9.6.0',
          minimum_wire_compatibility_version: expect.any(String),
          minimum_index_compatibility_version: expect.any(String),
        },
        tagline: expect.any(String),
      });

      expect(JSON.parse(mapping.toString())).toEqual({
        books: {
          mappings: { properties: { author: { type: 'keyword' }, name: { type: 'text' } } },
        },
      });
    });
  });
});
