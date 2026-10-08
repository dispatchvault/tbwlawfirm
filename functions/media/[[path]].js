// GET /media/* — video and other media with HTTP Range support (see server/media.js)
import { serveMedia } from '../../server/media.js';

export const onRequestGet = ({ request, env }) => serveMedia(request, env);
export const onRequestHead = ({ request, env }) => serveMedia(request, env);
