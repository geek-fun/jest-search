import fetch from 'node-fetch';
import { EngineType } from './constants';
import { debug } from './debug';
import { IndexBody } from './engine';

export interface EngineClient {
  heartbeat: () => Promise<number>;
  createIndex: (index: IndexBody) => Promise<void>;
  deleteIndex: (index: IndexBody) => Promise<void>;
}

const host = 'http://localhost';
export const createClient = (
  port: number,
  engine: EngineType,
  authorization = ''
): EngineClient => {
  const headers = { 'Content-Type': 'application/json', authorization };
  const get = async <T>(path: string): Promise<{ status: number; data: T }> => {
    const res = await fetch(`${host}:${port}${path}`, { headers });
    const data = await res.json();

    return { status: res.status, data };
  };

  const post = async <T>(path: string, body?: unknown): Promise<{ status: number; data: T }> => {
    const res = await fetch(`${host}:${port}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return { status: res.status, data };
  };
  const del = async (path: string): Promise<{ status: number; data: unknown }> => {
    const res = await fetch(`${host}:${port}${path}`, { method: 'DELETE', headers });
    const data = await res.json();
    return { status: res.status, data };
  };
  const heartbeat = async (): Promise<number> => {
    try {
      const { status } = await get(engine === EngineType.ZINCSEARCH ? `/es` : '');
      return status;
    } catch (error) {
      debug(`heartbeat error: ${error}`);
      return 0;
    }
  };
  const createIndex = async ({ name, body, mappings }: IndexBody) => {
    debug(`creating index: ${name}`);
    const { status, data } = await post(
      engine === EngineType.ZINCSEARCH ? '/api/index' : `/${name}`,
      engine === EngineType.ZINCSEARCH ? { name, mappings } : body
    );
    if (status !== 200) {
      throw new Error(`failed to create index: ${name}, status: ${status}, data: ${data}`);
    }
  };
  const deleteIndex = async ({ name }: IndexBody) => {
    debug(`deleting index: ${name}`);
    const { status, data } = await del(
      engine === EngineType.ZINCSEARCH ? `/api/index/${name}` : `/${name}`
    );
    if (status !== 200) {
      throw new Error(`failed to delete index: ${name}, status: ${status}, response: ${data}`);
    }
  };
  return { heartbeat, createIndex, deleteIndex };
};
