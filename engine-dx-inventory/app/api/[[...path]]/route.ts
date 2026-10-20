import { env } from 'cloudflare:workers';
import { createApi } from '../../../lib/api.mjs';
import catalog from '../../../public/models/parts.json';
export const dynamic='force-dynamic';
export const GET=(request:Request)=>createApi(env,catalog)(request);
export const POST=GET;
export const PATCH=GET;
