import mongoose from 'mongoose';
import env from '../config/env.js';

export const errorHandler = (error, _req, res, next) => {
  if (res.headersSent) return next(error);
  let status = error.statusCode || 500;
  let message = error.message || 'Internal server error';
  if (error instanceof mongoose.Error.ValidationError) { status = 400; message = 'Validation failed'; }
  if (error instanceof mongoose.Error.DocumentNotFoundError) { status = 404; message = 'Record not found'; }
  if (error instanceof mongoose.Error.CastError) { status = 400; message = `Invalid ${error.path}`; }
  if (error?.code === 11000) { status = 409; message = 'A record with that value already exists'; }
  const body = { error: { message } };
  if (error.details) body.error.details = error.details;
  if (env.nodeEnv !== 'production' && status === 500) body.error.stack = error.stack;
  res.status(status).json(body);
};
