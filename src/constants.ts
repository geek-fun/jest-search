export const DISABLE_PROXY = {
  env: { http_proxy: undefined, https_proxy: undefined, all_proxy: undefined },
};

export enum Artifacts {
  ES = 'https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch',
  OS = 'https://artifacts.opensearch.org/releases/bundle/opensearch',
  ZINC = 'https://github.com/zincsearch/zincsearch/releases/download',
}

export enum EngineType {
  ZINCSEARCH = 'zincsearch',
  ELASTICSEARCH = 'elasticsearch',
  OPENSEARCH = 'opensearch',
}
