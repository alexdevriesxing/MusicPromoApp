import mongoose, { Document, Schema } from 'mongoose';

export interface IEmailTemplate extends Document {
  name: string;
  subject: string;
  body: string;
  variables: string[];
  previewText?: string;
  isDefault: boolean;
  category?: string;
  thumbnail?: string;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const emailTemplateSchema = new Schema<IEmailTemplate>(
  {
    name: { 
      type: String, 
      required: true, 
      trim: true,
      unique: true,
    },
    subject: { 
      type: String, 
      required: true,
      trim: true,
    },
    body: { 
      type: String, 
      required: true,
    },
    variables: [{
      type: String,
      trim: true,
    }],
    previewText: {
      type: String,
      trim: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    category: {
      type: String,
      trim: true,
    },
    thumbnail: {
      type: String,
      trim: true,
    },
    createdBy: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
    updatedBy: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better query performance
emailTemplateSchema.index({ name: 1 }, { unique: true });
emailTemplateSchema.index({ isDefault: 1 });
emailTemplateSchema.index({ category: 1 });
emailTemplateSchema.index({ createdBy: 1 });

// Ensure only one default template per category
emailTemplateSchema.pre('save', async function(next) {
  if (this.isModified('isDefault') && this.isDefault) {
    try {
      // Find and unset any other default template in the same category
      await this.model('EmailTemplate').updateMany(
        { 
          _id: { $ne: this._id },
          category: this.category,
          isDefault: true 
        },
        { $set: { isDefault: false } }
      );
      next();
    } catch (error: any) {
      next(error);
    }
  } else {
    next();
  }
});

const EmailTemplate = mongoose.model<IEmailTemplate>('EmailTemplate', emailTemplateSchema);

export default EmailTemplate;
