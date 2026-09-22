import mongoose from 'mongoose';

const assetSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Asset name is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: {
        values: ['HVAC', 'Generator', 'Lift', 'Pump', 'Other'],
        message: '{VALUE} is not a valid asset type',
      },
      required: [true, 'Asset type is required'],
    },
    location: {
      building: {
        type: String,
        trim: true,
      },
      zone: {
        type: String,
        trim: true,
      },
    },
    department: {
      type: String,
      enum: {
        values: ['Electrical', 'HVAC', 'Plumbing', 'IT', 'General'],
        message: '{VALUE} is not a valid department',
      },
      required: [true, 'Department is required'],
    },
    installedDate: {
      type: Date,
      required: [true, 'Installed date is required'],
    },
    maintenanceIntervalDays: {
      type: Number,
      required: [true, 'Maintenance interval in days is required'],
      min: [1, 'Maintenance interval must be at least 1 day'],
    },
    lastServicedDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: {
        values: ['Healthy', 'Watch', 'Critical'],
        message: '{VALUE} is not a valid status',
      },
      default: 'Healthy',
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

assetSchema.index({ department: 1, status: 1, active: 1 });

const Asset = mongoose.model('Asset', assetSchema);

export default Asset;
