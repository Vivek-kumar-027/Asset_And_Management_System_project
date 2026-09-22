import mongoose from 'mongoose';

const maintenanceLogSchema = new mongoose.Schema(
  {
    assetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset',
      required: [true, 'assetId is required'],
      index: true,
    },
    type: {
      type: String,
      enum: {
        values: ['ai-flag', 'manual-entry', 'resolution'],
        message: '{VALUE} is not a valid maintenance log type',
      },
      required: [true, 'Maintenance log type is required'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    loggedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    relatedAlertId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Alert',
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }
);

maintenanceLogSchema.index({ assetId: 1, createdAt: -1 });

const MaintenanceLog = mongoose.model('MaintenanceLog', maintenanceLogSchema);

export default MaintenanceLog;
