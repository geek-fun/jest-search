# jest-search
[![Node.js CI](https://github.com/geek-fun/jest-search/actions/workflows/node.yml/badge.svg)](https://github.com/geek-fun/jest-search/actions/workflows/node.yml)
[![.github/workflows/release.yml](https://github.com/geek-fun/jest-search/actions/workflows/release.yml/badge.svg)](https://github.com/geek-fun/jest-search/actions/workflows/release.yml)
[![Known Vulnerabilities](https://snyk.io/test/github/geek-fun/jest-search/badge.svg)](https://snyk.io/test/github/geek-fun/jest-search)
[![codecov](https://codecov.io/gh/geek-fun/jest-search/branch/master/graph/badge.svg?token=KYTVHHKCI5)](https://codecov.io/gh/geek-fun/jest-search)
[![npm version](https://badge.fury.io/js/@geek-fun%2Fjest-search.svg)](https://badge.fury.io/js/@geek-fun%2Fjest-search)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Jest preset for running tests with local ElasticSearch, OpenSearch and ZincSearch.

## Usage
**Prerequisite:**

ElasticSearch and OpenSearch relies on Java, please make sure you have Java installed and `JAVA_HOME` is set.

`jest-search` provide two ways to set up, one is two set up globally, another is running in specific test only

###  set up globally
**1. install library** 

```bash
npm install --save-dev @geek-fun/jest-search
```

**2. create config file `jest-search-config.js`** 

> all configuration items are optional, but it still requires you to `module. exports` the function in `jest-search-config.js`,  there aren't any indexes created without passing the indexes configuration,

```javascript
module.exports = () => {
  return {
    engine: 'elasticsearch', // or 'opensearch' or 'zincsearch'
    version: '8.8.2',
    port: 9200,
    binaryLocation: '', // optional
    clusterName: 'jest-search-local',
    nodeName: 'jest-search-local',
    zincAdmin: 'admin',
    zincPassword: 'Complexpass#123',
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

- engine: <string> specify startup search engine platform

  > allowed value: `elasticsearch`, `opensearch`, `zincsearch`
  >
  > default: `elasticsearch`

- version:  <string> specify startup search engine version

  > allowed value: check the versions in each platform's release page
  >
  > default: `8.8.2`

- port: <number> specify startup search engine port number

  > allowed value: 1024 ~ 2147483647
  >
  > default: `9200`

- binaryLocation:<string> use downloaded  engine instead default: `undefined`

- clusterName:<string> engine's clusterName default: `jest-search-local`

- nodeName: engine's nodeName default: `jest-search-local`

- indexes: specify the configuration like index name, and mapping of  indexes that you want to create during the startup, and indexes will get deleted once test is finished: default: `[]`

- zincAdmin:<string> zincsearch requires pass env `ZINC_FIRST_ADMIN_USER` when starting zincsearch, default:  `admin`,

- zincPassword: <string> :  zincsearch requires pass env `ZINC_FIRST_ADMIN_PASSWORD` when starting zincsearch, default:  `Complexpass#123`




**3. create  `jest-global-setup.js`**

```javascript
const { globalSetup } = require('@geek-fun/jest-search');
module.exports = async () => {
  await Promise.all([globalSetup()]);
};
```



**4. create  `jest-global-teardown.js`**

```javascript
const { globalTeardown } = require('@geek-fun/jest-search');
module.exports = async () => {
  await Promise.all([globalTeardown()]);
};
```



**4. modify the `jest-config.js`**

```javascript
module.exports = {
	...
  globalSetup: '<rootDir>/jest-global-setup.js',
  globalTeardown: '<rootDir>/jest-global-teardown.js',
};
```

**3. play with your tests**

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
### specific test only
the step 1 and 2 are the same as above, `jest-search` export two methods `startEngine` and `stopEngine` to start and stop the search engine, you can manually call them in your test file, the `startEngine` accepts same argument object as defined in `jest-search-config.js` file
```typescript
import { startEngine, stopEngine } from '@geek-fun/jest-search';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import loadConfig from '../jest-search-config.js';


describe('integration test for elasticsearch', () => {
  beforeAll(async () => {
    await startEngine(loadConfig());
    await saveBook(mockBook);
  });
  afterAll(async () => {
    await stopEngine();
  });
  it('should get book when search with valid book name', async () => {
    // ...
  });
});

```

### Known issues

1. Windows is not on the support list yet, I didn't see the necessity of it yet, feel free to reach out if you have the needs to use it on Windows, then will prioritize it
