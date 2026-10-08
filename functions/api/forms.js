// POST /api/forms — website forms (see server/forms.js)
import { handleForm } from '../../server/forms.js';

export const onRequest = ({ request, env }) => handleForm(request, env);
