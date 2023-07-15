import { EngineType, startEngine, stopEngine } from '../src/engine';
import { execSync } from 'child_process';
import { DISABLE_PROXY } from '../src/constants';
import { v4 as uuid } from 'uuid';

const getRandomInt = (min = 1025, max = 9999) => Math.floor(Math.random() * (max - min) + min);

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

const engineMartix = [
  {
    engine: EngineType.ELASTICSEARCH,
    version: '8.8.2',
    port: getRandomInt(),
    clusterName: uuid(),
    nodeName: uuid(),
    indexes,
  },
  {
    engine: EngineType.ELASTICSEARCH,
    version: '7.17.11',
    port: getRandomInt(),
    clusterName: uuid(),
    nodeName: uuid(),
    indexes,
  },
  {
    engine: EngineType.ELASTICSEARCH,
    version: '6.8.23',
    port: getRandomInt(),
    clusterName: uuid(),
    nodeName: uuid(),
    indexes: indexes.map((conf) => ({
      ...conf,
      body: { ...conf.body, mappings: { _doc: conf.body.mappings } },
    })),
  },
  {
    engine: EngineType.OPENSEARCH,
    version: '2.8.0',
    port: getRandomInt(),
    clusterName: uuid(),
    nodeName: uuid(),
    indexes: indexes,
  },
  {
    engine: EngineType.OPENSEARCH,
    version: '1.3.10',
    port: getRandomInt(),
    clusterName: uuid(),
    nodeName: uuid(),
    indexes: indexes,
  },
  {
    engine: EngineType.ZINCSEARCH,
    version: '0.4.7',
    port: 9200,
    clusterName: 'N/A',
    nodeName: 'N/A',
    indexes: [{ ...indexes[0], mappings: indexes[0].body.mappings }],
    zincAdmin: 'admin',
    zincPassword: 'Complexpass#123',
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

engineMartix.forEach((engineConfig) => {
  const { engine, version, indexes, port, clusterName, nodeName, zincAdmin, zincPassword } =
    engineConfig;

  describe(`unit test for ${engine}-${version}:${port}`, () => {
    it(`should start ${engine}-${version} and create index`, async () => {
      await startEngine({ engine, version, port, clusterName, nodeName, indexes });

      const inspect = await execSync(
        engine === EngineType.ZINCSEARCH
          ? `curl -s "http://localhost:${port}/es/"`
          : `curl -s "http://localhost:${port}/?pretty"`,
        DISABLE_PROXY
      );
      const mapping = await execSync(
        engine === EngineType.ZINCSEARCH
          ? `curl -s "http://localhost:${port}/api/${indexes[0].name}/_mapping" -u ${zincAdmin}:${zincPassword}`
          : `curl -s "http://localhost:${port}/books/_mapping?pretty"`,
        DISABLE_PROXY
      );

      await stopEngine();

      expect(JSON.parse(inspect.toString())).toMatchObject({
        name: engine === EngineType.ZINCSEARCH ? 'zinc' : nodeName,
        cluster_name: clusterName,
        version: {
          number: version,
          build_snapshot: false,
          lucene_version: expect.any(String),
        },
        tagline: expect.any(String),
      });

      if (engine === EngineType.ZINCSEARCH) {
        expect(JSON.parse(mapping.toString())).toEqual({
          books: {
            mappings: {
              properties: {
                '@timestamp': {
                  aggregatable: true,
                  highlightable: false,
                  index: true,
                  sortable: true,
                  store: false,
                  type: 'date',
                },
                _id: {
                  aggregatable: true,
                  highlightable: false,
                  index: true,
                  sortable: true,
                  store: false,
                  type: 'keyword',
                },
                author: {
                  aggregatable: true,
                  highlightable: false,
                  index: true,
                  sortable: true,
                  store: false,
                  type: 'keyword',
                },
                name: {
                  aggregatable: false,
                  highlightable: false,
                  index: true,
                  sortable: false,
                  store: false,
                  type: 'text',
                },
              },
            },
          },
        });
      } else {
        expect(JSON.parse(mapping.toString())).toEqual({
          books: { mappings: indexes[0].body.mappings },
        });
      }
    });
  });
});
