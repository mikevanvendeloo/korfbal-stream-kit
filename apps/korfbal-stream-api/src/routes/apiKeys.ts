import {Router} from 'express';
import {ApiKeyCreateSchema} from '../schemas/organization';
import {createApiKey, listApiKeys, revokeApiKey} from '../services/apiKeys';

/**
 * API keys of the chosen organization (Beheer → Organisatie → API-sleutels, D7). The full key is only
 * in the answer to POST; the list shows the prefix. A key never opens these routes itself.
 */
export const apiKeysRouter: Router = Router();

apiKeysRouter.get('/', async (_req, res, next) => {
  try {
    return res.json(await listApiKeys());
  } catch (err) {
    return next(err);
  }
});

apiKeysRouter.post('/', async (req, res, next) => {
  try {
    const parsed = ApiKeyCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'Geef de sleutel een naam'});
    // Not cached anywhere on the way back: the only time the key is sent
    res.set('Cache-Control', 'no-store');
    return res.status(201).json(await createApiKey(parsed.data.name));
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/organization/api-keys/:id -> revokes the key (it stays in the list, marked revoked)
apiKeysRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({error: 'Invalid id'});
    const revoked = await revokeApiKey(id);
    if (!revoked) return res.status(404).json({error: 'Niet gevonden'});
    return res.json(revoked);
  } catch (err) {
    return next(err);
  }
});
