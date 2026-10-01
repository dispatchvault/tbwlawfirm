/**
 * Worker in front of the static assets. Cloudflare's asset server ignores
 * HTTP Range requests (it always answers 200 with the whole file), and Safari
 * / iOS refuse to play <video> without 206 partial responses — so the
 * homepage hero video never starts there. wrangler.jsonc routes only /media/*
 * through this worker; everything else is served straight from the assets.
 */
export default {
  async fetch(request, env) {
    const res = await env.ASSETS.fetch(request.url, { method: request.method === 'HEAD' ? 'HEAD' : 'GET' });
    if (res.status !== 200) return res;

    const headers = new Headers(res.headers);
    headers.set('Accept-Ranges', 'bytes');
    const range = request.headers.get('Range');
    if (request.method === 'HEAD' || !range) {
      return new Response(res.body, { status: 200, headers });
    }

    const body = await res.arrayBuffer();
    const size = body.byteLength;
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    let start;
    let end;
    if (m && m[1] !== '') {
      start = Number(m[1]);
      end = m[2] !== '' ? Math.min(Number(m[2]), size - 1) : size - 1;
    } else if (m && m[2] !== '') {
      // suffix range: the last N bytes
      start = Math.max(0, size - Number(m[2]));
      end = size - 1;
    }
    if (start === undefined || start > end || start >= size) {
      headers.set('Content-Range', `bytes */${size}`);
      headers.delete('Content-Length');
      return new Response(null, { status: 416, headers });
    }

    headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
    headers.set('Content-Length', String(end - start + 1));
    return new Response(new Uint8Array(body, start, end - start + 1), { status: 206, headers });
  }
};
