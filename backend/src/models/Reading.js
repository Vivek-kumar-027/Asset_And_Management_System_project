import mongoose from 'mongoose';

const readingSchema = new mongoose.Schema(
  {
    assetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset',
      required: [true, 'assetId is required'],
      index: true,
    },
    timestamp: {
      type: Date,
      required: [true, 'timestamp is required'],
      index: true,
    },
    temperature: {
      type: Number,
      default: null,
    },
    runtimeHours: {
      type: Number,
      required: [true, 'runtimeHours is required'],
      min: [0, 'runtimeHours cannot be negative'],
    },
    errorCode: {
      type: String,
      default: null,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }
);

readingSchema.index({ assetId: 1, timestamp: 1 });

const Reading = mongoose.model('Reading', readingSchema);

export default Reading;
