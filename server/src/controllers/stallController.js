import Stall from '../models/Stall.js';
export const listStalls = async (_req, res) => res.json({ stalls: await Stall.find({ isActive: true }).sort({ stallName: 1 }).lean() });
export const getStall = async (req, res) => res.json({ stall: await Stall.findOne({ _id: req.params.id, isActive: true }).orFail() });
