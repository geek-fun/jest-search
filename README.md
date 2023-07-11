# jest-search
[![Node.js CI](https://github.com/geek-fun/jest-search/actions/workflows/node.yml/badge.svg)](https://github.com/geek-fun/jest-search/actions/workflows/node.yml)
[![.github/workflows/release.yml](https://github.com/geek-fun/jest-search/actions/workflows/release.yml/badge.svg)](https://github.com/geek-fun/jest-search/actions/workflows/release.yml)
[![codecov](https://codecov.io/gh/geek-fun/jest-search/branch/master/graph/badge.svg?token=KYTVHHKCI5)](https://codecov.io/gh/geek-fun/jest-search)
[![npm version](https://badge.fury.io/js/@geek-fun%2Fjest-search.svg)](https://badge.fury.io/js/@geek-fun%2Fjest-search)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Jest preset for running tests with local ElasticSearch, OpenSearch and ZincSearch.

## Usage
**Prerequisite:**
ElasticSearch and OpenSearch relies on Java, please make sure you have Java installed and `JAVA_HOME` is set.

**1. install library** 
```bash
npm install --save-dev @geek-fun/jest-search
```

**2. create config file `jest-search-config.js`** 
```javascript
module.exports = () => {
  return {
    engine: 'elasticearch', // or 'opensearch' or 'zincsearch'
    version: '8.8.2',
    port: 9200,
    binaryLocation: '', // optional
    clusterName: 'jest-search-local',
    nodeName: 'jest-search-local',
    indexes: [
      {
        name: 'index-name',
        body: {
          settings: {
            number_of_shards: '1',
            number_of_replicas: '1'
          },
          aliases: {
            'your-alias': {}
          },
          mappings: {
            dynamic: false,
            properties: {
              id: {
                type: 'keyword'
              }
            }
          }
        }
      }
    ]
  };
};
```

**3. modify the `jest-config.js`**
```javascript
module.exports = {
  preset: '@geek-fun/jest-search',
};
```

**3. play with your test**
```typescript
// tests/utils/helper.ts sample utils to add item for test
export const saveBook = async (bookDoc: { name: string; author: string }) => {
  await esClient.index({ index, body: bookDoc, refresh: true });
};

// tests/book.test.ts sample test
beforeAll(async () => {
  await saveBook(mockBook);
});
```
