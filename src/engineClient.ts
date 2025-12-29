import fetch, { Response } from 'node-fetch';
import { EngineType } from './constants';
import { debug } from './debug';
import { IndexBody } from './engine';

export interface EngineClient {
  heartbeat: () => Promise<number>;
  createIndex: (index: IndexBody) => Promise<void>;
  deleteIndex: (index: IndexBody) => Promise<void>;
}

const handleResponse = async <T>(res: Response): Promise<{ status: number; data: T }> => {
  const contentType = res.headers.get('content-type');
  let data: T;

  if (contentType && contentType.includes('application/json')) {
    data = await res.json();
  } else {
    const text = await res.text();
    debug(`Non-JSON response received: ${text}`);
    data = text as unknown as T;
  }

  return { status: res.status, data };
};

const host = 'http://localhost';
export const createClient = (
  port: number,
  engine: EngineType,
  authorization = '',
): EngineClient => {
  const headers = { 'Content-Type': 'application/json', authorization };
  const get = async <T>(path: string): Promise<{ status: number; data: T }> => {
    const res = await fetch(`${host}:${port}${path}`, { headers });
    return handleResponse<T>(res);
  };

  const put = async <T>(path: string, body?: unknown): Promise<{ status: number; data: T }> => {
    const res = await fetch(`${host}:${port}${path}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
    return handleResponse<T>(res);
  };

  const del = async (path: string): Promise<{ status: number; data: unknown }> => {
    const res = await fetch(`${host}:${port}${path}`, { method: 'DELETE', headers });
    return handleResponse(res);
  };

  const heartbeat = async (): Promise<number> => {
    try {
      const { status, data } = await get(engine === EngineType.ZINCSEARCH ? `/es` : '');

      // 检查状态码是否为200，对于Elasticsearch，还应验证响应内容
      if (status === 200) {
        // 对于Elasticsearch，确认返回的是有效响应
        if (engine !== EngineType.ZINCSEARCH && typeof data === 'string') {
          // 如果收到的是字符串而非预期的JSON，认为服务未准备好
          debug(`Invalid response format for heartbeat: ${data}`);
          return 0;
        }
        return status;
      } else {
        return 0;
      }
    } catch (error) {
      debug(`heartbeat error: ${error}`);
      return 0;
    }
  };

  const createIndex = async ({ name, body, mappings }: IndexBody) => {
    debug(`creating index: ${name}`);
    const { status, data } = await put(
      engine === EngineType.ZINCSEARCH ? '/api/index' : `/${name}`,
      engine === EngineType.ZINCSEARCH ? { name, mappings } : body,
    );
    if (status !== 200) {
      throw new Error(
        `failed to create index: ${name}, status: ${status}, data: ${JSON.stringify(data)}`,
      );
    }
  };

  const deleteIndex = async ({ name }: IndexBody) => {
    debug(`deleting index: ${name}`);
    const { status, data } = await del(
      engine === EngineType.ZINCSEARCH ? `/api/index/${name}` : `/${name}`,
    );
    if (status !== 200) {
      throw new Error(
        `failed to delete index: ${name}, status: ${status}, response: ${JSON.stringify(data)}`,
      );
    }
  };

  return { heartbeat, createIndex, deleteIndex };
};
