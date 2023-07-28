import { EngineType, startEngine, stopEngine } from '../src';
import { diagnose, fetchMapping } from './utils/common';

const { engine, clusterName, nodeName, indexes, version, port, zincAdmin, zincPassword } = {
  engine: EngineType.ZINCSEARCH,
  version: '0.4.7',
  port: 9200,
  clusterName: 'N/A',
  nodeName: 'N/A',
  indexes: [
    {
      name: 'books',
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
  ],
  zincAdmin: 'admin',
  zincPassword: 'Complexpass#123',
};

describe('integration test for zincsearch', () => {
  it(`should start zincsearch-${version}:${port} and create index`, async () => {
    await startEngine({ engine, version, port, clusterName, nodeName, indexes });

    const { status: inspectStatus, ...others } = await diagnose(
      engine,
      port,
      zincAdmin,
      zincPassword
    );
    const { status: mappingStatus, mapping } = await fetchMapping(
      engine,
      port,
      indexes[0].name,
      zincAdmin,
      zincPassword
    );

    await stopEngine();

    expect(inspectStatus).toEqual(200);
    expect(others).toEqual({
      name: 'zinc',
      clusterName,
      version: version,
    });
    expect(mappingStatus).toEqual(200);
    expect(mapping).toEqual({
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
  });
});
