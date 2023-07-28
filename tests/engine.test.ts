import { EngineType, startEngine, stopEngine } from '../src';
import { engineMartix, indexes } from './utils/fixtures';
import { diagnose, fetchMapping } from './utils/common';

describe('integration test for elasticsearch and opensearch', () => {
  it(`should start engine with default config`, async () => {
    await startEngine();

    const inspect = await diagnose(EngineType.ELASTICSEARCH, 9200);

    await stopEngine();

    expect(inspect).toMatchObject({
      status: 200,
      name: 'jest-search-local',
      clusterName: 'jest-search-local',
      version: '8.8.2',
    });
  });

  it('should start engine and create indexes when only passing indexes', async () => {
    await startEngine({ indexes: [indexes[0]] });

    const mapping = await fetchMapping(EngineType.ELASTICSEARCH, 9200, 'books');

    await stopEngine();

    expect(mapping).toEqual({
      status: 200,
      books: {
        mappings: { properties: { author: { type: 'keyword' }, name: { type: 'text' } } },
      },
    });
  });

  engineMartix.forEach((engineConfig) => {
    const { engine, version, indexes, port, clusterName, nodeName } = engineConfig;

    it(`should start ${engine}-${version}:${port} and create index`, async () => {
      await startEngine({ engine, version, port, clusterName, nodeName, indexes });
      const inspect = await diagnose(engine, port);

      const mapping = await fetchMapping(engine, port, indexes[0].name);

      await stopEngine();

      expect(inspect).toMatchObject({
        status: 200,
        name: nodeName,
        cluster_name: clusterName,
        version,
      });
      expect(mapping).toEqual({ books: { status: 200, mappings: indexes[0].body.mappings } });
    });
  });
});
