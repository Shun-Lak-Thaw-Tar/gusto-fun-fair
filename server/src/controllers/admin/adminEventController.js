import { z } from 'zod';
import EventConfig from '../../models/EventConfig.js';
import ApiError from '../../utils/ApiError.js';

const featureFlagsSchema = z.object({ memoriesEnabled: z.boolean().optional(), eventPageEnabled: z.boolean().optional() }).strict().refine((value) => Object.keys(value).length > 0, { message: 'At least one feature flag is required' });
const schema = z.object({ eventName: z.string().trim().min(1).optional(), eventDate: z.coerce.date().optional(), eventTimezone: z.literal('Asia/Yangon').optional(), preorderOpenAt: z.coerce.date().optional(), preorderCloseAt: z.coerce.date().optional(), orderingEnabled: z.boolean().optional(), featureFlags: featureFlagsSchema.optional(), kbzAccountName: z.string().trim().optional(), kbzAccountNumber: z.string().trim().optional(), paymentInstructions: z.string().trim().optional(), orderReservationMinutes: z.number().int().min(1).optional(), paymentProofGraceMinutes: z.number().int().min(1).optional() }).strict().refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

export const getEvent = async (_req, res) => { const event = await EventConfig.findOne({ configKey: 'current' }); if (!event) throw new ApiError(404, 'Current event configuration not found'); res.json({ event }); };
export const updateEvent = async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid event configuration', z.treeifyError(parsed.error));
  const event = await EventConfig.findOne({ configKey: 'current' });
  if (!event) throw new ApiError(404, 'Current event configuration not found');
  const eventDate = parsed.data.eventDate || event.eventDate;
  const openAt = parsed.data.preorderOpenAt || event.preorderOpenAt;
  const closeAt = parsed.data.preorderCloseAt || event.preorderCloseAt;
  if (openAt >= closeAt) throw new ApiError(400, 'Preorder opening must be before closing');
  if (closeAt >= eventDate) throw new ApiError(400, 'Preorder closing must be before the event');
  const { featureFlags, ...updates } = parsed.data;
  Object.assign(event, updates);
  if (featureFlags) {
    for (const [key, value] of Object.entries(featureFlags)) event.featureFlags[key] = value;
  }
  await event.save();
  res.json({ event });
};
