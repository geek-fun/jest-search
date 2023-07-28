import fetch from 'node-fetch';
import { EngineType } from '../../src';

export const getRandomInt = (min = 1025, max = 9999) =>
  Math.floor(Math.random() * (max - min) + min);
const generateAuthorization = (zincAdmin?: string, zincPassword?: string) =>
  zincAdmin && zincPassword
    ? `Basic ${Buffer.from(zincAdmin + ':' + zincPassword).toString('base64')}`
    : '';
export const diagnose = async (
  engine: EngineType,
  port: number,
  zincAdmin?: string,
  zincPassword?: string
) => {
  const response = await fetch(
    `http://localhost:${port}${engine === EngineType.ZINCSEARCH ? '/es' : '/?pretty'}`,
    { headers: { authorization: generateAuthorization(zincAdmin, zincPassword) } }
  );
  const data = await response.json();

  return {
    status: response.status,
    name: data.name,
    clusterName: data.cluster_name,
    version: data.version.number,
  };
};

export const fetchMapping = async (
  engine: EngineType,
  port: number,
  indexName: string,
  zincAdmin?: string,
  zincPassword?: string
) => {
  const response = await fetch(
    `http://localhost:${port}${
      engine === EngineType.ZINCSEARCH ? '/api' : ''
    }/${indexName}/_mapping`,
    {
      headers: {
        'Content-Type': 'application/json',
        authorization: generateAuthorization(zincAdmin, zincPassword),
      },
    }
  );
  const data = await response.json();

  return { status: response.status, mapping: data };
};
