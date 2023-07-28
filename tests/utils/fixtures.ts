import { EngineType } from '../../src';
import { v4 as uuid } from 'uuid';
import { getRandomInt } from './common';

export const indexes = [
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

export const engineMartix = [
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
];
