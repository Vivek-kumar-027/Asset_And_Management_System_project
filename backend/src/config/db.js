import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('FATAL: MONGO_URI environment variable is not set.');
      console.error('Please configure MONGO_URI in your hosting Environment settings.');
      process.exit(1);
    }
    const conn = await mongoose.connect(mongoUri);
    console.log('MongoDB Connected: ' + conn.connection.host);
    return conn;
  } catch (error) {
    console.error('MongoDB Connection Error: ' + error.message);
    process.exit(1);
  }
};
