import { startEngine, stopEngine } from '../src/engine';
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

jest.setTimeout(10 * 60 * 1000);
describe('unit test for elasticearch', () => {
  it('should start engine with default config', async () => {
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
      books: { mappings: { properties: { author: { type: 'keyword' }, name: { type: 'text' } } } },
    });
  });
});
