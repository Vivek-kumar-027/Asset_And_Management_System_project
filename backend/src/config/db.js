import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://campus_database_admin:lx2DHXuwHS9ATBai@collegemanegementdataba.jlg12cn.mongodb.net/asset_mangement_db?appName=CollegeManegementDatabase');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};
