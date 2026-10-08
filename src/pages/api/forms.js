// POST /api/forms — website forms (see server/forms.js). Rendered on demand
// as a Vercel function; every other page is static.
import { handleForm } from '../../../server/forms.js';

export const prerender = false;

export const ALL = ({ request }) => handleForm(request, process.env);
