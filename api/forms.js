// POST /api/forms — website forms (see server/forms.js). A plain Vercel
// function next to the static Astro build; no Astro runtime involved.
import { handleForm } from '../server/forms.js';

const handle = (request) => handleForm(request, process.env);

export const GET = handle;
export const POST = handle;
