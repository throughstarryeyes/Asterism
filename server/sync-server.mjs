// reference sync server for asterism: one json file per project, a bearer token and etag checks
// see server/README.md for usage and routes

import { createServer } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAFE_ID = /^[A-Za-z0-9_.-]{1,120}$/;
const MAX_ASSET = 32 * 1024 * 1024;

const etagOf = body => `"${createHash('sha256').update(body).digest('hex').slice(0, 32)}"`;

function tokenOk(header, token) {
  if (!token) return true;
  const given = Buffer.from((header ?? '').replace(/^Bearer\s+/i, ''));
  const want = Buffer.from(token);
  return given.length === want.length && timingSafeEqual(given, want);
}

export function createSyncServer({ dir, token = '' }) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, If-Match, If-None-Match, X-Asset-Meta',
    'Access-Control-Expose-Headers': 'ETag',
  };
  const send = (res, status, body = '', headers = {}) => {
    res.writeHead(status, { ...cors, ...headers });
    res.end(body);
  };

  const handleAssets = async (req, res, id, asset) => {
    if (!tokenOk(req.headers.authorization, token)) return send(res, 401, 'bad token');
    if (!SAFE_ID.test(id) || id.includes('..') || (asset !== null && (!SAFE_ID.test(asset) || asset.includes('..')))) return send(res, 400, 'bad id');
    const folder = join(dir, `${id}.assets`);

    if (asset === null) {
      if (req.method !== 'GET') return send(res, 405, 'method not allowed');
      let names = [];
      try { names = await readdir(folder); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      const list = [];
      for (const name of names.filter(n => n.endsWith('.json'))) {
        try { list.push(JSON.parse(await readFile(join(folder, name), 'utf8'))); } catch { /* skip a damaged entry */ }
      }
      return send(res, 200, JSON.stringify(list), { 'Content-Type': 'application/json' });
    }

    const data = join(folder, `${asset}.bin`);
    if (req.method === 'GET') {
      let bytes;
      try { bytes = await readFile(data); } catch (e) { if (e.code === 'ENOENT') return send(res, 404, 'no such file'); throw e; }
      return send(res, 200, bytes, { 'Content-Type': 'application/octet-stream' });
    }
    if (req.method === 'PUT') {
      let meta;
      try { meta = JSON.parse(decodeURIComponent(req.headers['x-asset-meta'] ?? '')); } catch { return send(res, 400, 'bad X-Asset-Meta'); }
      if (!meta || meta.id !== asset || !['font', 'image', 'sound', 'extras'].includes(meta.kind)) return send(res, 400, 'bad X-Asset-Meta');
      const chunks = [];
      let size = 0;
      for await (const c of req) {
        size += c.length;
        if (size > MAX_ASSET) return send(res, 413, 'too large');
        chunks.push(c);
      }
      await mkdir(folder, { recursive: true });
      // a file with this id is the same file: keep it instead of letting another device replace it
      if (meta.kind !== 'extras') {
        try { await readFile(data); return send(res, 200); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      }
      await writeFile(`${data}.tmp`, Buffer.concat(chunks));
      await rename(`${data}.tmp`, data);
      await writeFile(join(folder, `${asset}.json`), JSON.stringify({ ...meta, size }));
      return send(res, 200);
    }
    if (req.method === 'DELETE') {
      for (const f of [data, join(folder, `${asset}.json`)]) {
        try { await unlink(f); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      }
      return send(res, 200);
    }
    return send(res, 405, 'method not allowed');
  };

  const handle = async (req, res) => {
    try {
      if (req.method === 'OPTIONS') return send(res, 204);
      const path = (req.url ?? '').split('?')[0];
      const files = /^\/projects\/([^/]+)\/assets(?:\/([^/]+))?$/.exec(path);
      if (files) return await handleAssets(req, res, decodeURIComponent(files[1]), files[2] === undefined ? null : decodeURIComponent(files[2]));
      const m = /^\/projects\/([^/]+)$/.exec(path);
      if (!m) return send(res, 404, 'not found');
      if (!tokenOk(req.headers.authorization, token)) return send(res, 401, 'bad token');

      const id = decodeURIComponent(m[1]);
      if (!/^[A-Za-z0-9_.-]{1,120}$/.test(id) || id.includes('..')) return send(res, 400, 'bad project id');
      const file = join(dir, `${id}.json`);

      let current = null;
      try { current = await readFile(file, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }

      if (req.method === 'GET') {
        if (current === null) return send(res, 404, 'no such project');
        return send(res, 200, current, { 'Content-Type': 'application/json', ETag: etagOf(current) });
      }
      if (req.method === 'PUT') {
        const chunks = [];
        let size = 0;
        for await (const c of req) {
          size += c.length;
          if (size > 64 * 1024 * 1024) return send(res, 413, 'too large');
          chunks.push(c);
        }
        const body = Buffer.concat(chunks).toString('utf8');
        try { JSON.parse(body); } catch { return send(res, 400, 'not json'); }

        const ifMatch = req.headers['if-match'];
        const ifNone = req.headers['if-none-match'];
        if (current === null ? ifMatch !== undefined : (ifNone === '*' || ifMatch !== etagOf(current))) {
          return send(res, 412, 'changed');
        }
        await mkdir(dir, { recursive: true });
        await writeFile(`${file}.tmp`, body);
        await rename(`${file}.tmp`, file);
        return send(res, 200, '', { ETag: etagOf(body) });
      }
      return send(res, 405, 'method not allowed');
    } catch (e) {
      console.error(e);
      return send(res, 500, 'server error');
    }
  };

  // one request at a time, so a check and the write after it cannot interleave
  let tail = Promise.resolve();
  return createServer((req, res) => {
    tail = tail.then(() => handle(req, res)).catch(() => {});
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 8787);
  const dir = process.env.DATA_DIR ?? './sync-data';
  const token = process.env.ASTERISM_TOKEN ?? '';
  if (!token) console.warn('No ASTERISM_TOKEN set: anyone who can reach this port can read and write projects.');
  createSyncServer({ dir, token }).listen(port, () => console.log(`Asterism sync server on :${port}, data in ${dir}`));
}
