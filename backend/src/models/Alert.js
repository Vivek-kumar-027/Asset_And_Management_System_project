import mongoose from 'mongoose';

const alertSchema = new mongoose.Schema(
  {
    assetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset',
      required: [true, 'assetId is required'],
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ['Watch', 'Critical'],
        message: '{VALUE} is not a valid alert status',
      },
      required: [true, 'Alert status is required'],
    },
    summary: {
      type: String,
      required: [true, 'Summary is required'],
      trim: true,
    },
    reasons: {
      type: [String],
      default: [],
    },
    triggeredAt: {
      type: Date,
      required: [true, 'triggeredAt is required'],
      default: Date.now,
      index: true,
    },
    acknowledged: {
      type: Boolean,
      default: false,
      index: true,
    },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
    resolved: {
      type: Boolean,
      default: false,
      index: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolutionNote: {
      type: String,
      default: null,
      trim: true,
    },
  }
);

alertSchema.index({ assetId: 1, resolved: 1 });

const Alert = mongoose.model('Alert', alertSchema);

export default Alert;
