import { getCurrentEvent, presentEvent } from '../services/eventService.js';

export const getEvent = async (_req, res) => res.json({ event: presentEvent(await getCurrentEvent()) });
