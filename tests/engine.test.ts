import { startEngine, stopEngine } from '../src/engine';
import { execSync } from 'child_process';

jest.setTimeout(10 * 60 * 1000);

it('should start engine with default config', async () => {
  await startEngine();
  const response = await execSync('curl -s "http://localhost:9200/?pretty"', {
    env: { http_proxy: undefined, https_proxy: undefined, all_proxy: undefined },
  });

  await stopEngine();

  expect(JSON.parse(response.toString())).toEqual({
    name: 'jest-search-local',
    cluster_name: 'jest-search-local',
    cluster_uuid: 'TVNghGWORHu0ae-RB-g41w',
    version: {
      number: '8.8.2',
      build_flavor: 'default',
      build_type: 'tar',
      build_hash: '98e1271edf932a480e4262a471281f1ee295ce6b',
      build_date: '2023-06-26T05:16:16.196344851Z',
      build_snapshot: false,
      lucene_version: '9.6.0',
      minimum_wire_compatibility_version: '7.17.0',
      minimum_index_compatibility_version: '7.0.0',
    },
    tagline: 'You Know, for Search',
  });
});
