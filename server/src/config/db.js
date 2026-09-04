import mongoose from 'mongoose';
import env from './env.js';

export const connectDatabase = async () => {
  await mongoose.connect(env.mongoUri);
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') {
    await mongoose.disconnect();
    throw new Error('Media uploads and payment review require MongoDB Atlas or a replica set; standalone MongoDB is not supported');
  }
  // Quota and reaction uniqueness must exist before accepting requests.
  await Promise.all(Object.values(mongoose.models).map(model => model.init()));
  return mongoose.connection;
};
export const disconnectDatabase = async () => mongoose.disconnect();
