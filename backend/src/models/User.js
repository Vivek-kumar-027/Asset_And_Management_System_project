import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/\S+@\S+\.\S+/, 'Please provide a valid email address'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
    },
    role: {
      type: String,
      enum: {
        values: ['Admin', 'DepartmentStaff'],
        message: '{VALUE} is not a valid user role',
      },
      required: [true, 'Role is required'],
    },
    department: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          if (this.role === 'DepartmentStaff') {
            return typeof v === 'string' && v.trim().length > 0;
          }
          return true;
        },
        message: 'Department is required for DepartmentStaff',
      },
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }
);

userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.passwordHash);
};

const User = mongoose.model('User', userSchema);

export default User;
