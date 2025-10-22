import { Schema, model, Document, Types } from 'mongoose';

export interface IContact extends Document {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  position?: string;
  country: string;
  city?: string;
  address?: string;
  postalCode?: string;
  website?: string;
  socialMedia?: {
    platform: string;
    url: string;
  }[];
  tags: string[];
  notes?: string;
  status: 'active' | 'inactive' | 'lead' | 'customer' | 'influencer';
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'failed';
  lastContacted?: Date;
  nextFollowUp?: Date;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  isFavorite: boolean;
}

const ContactSchema = new Schema<IContact>(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot be more than 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot be more than 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        'Please provide a valid email address',
      ],
    },
    phone: {
      type: String,
      trim: true,
    },
    company: {
      type: String,
      trim: true,
      maxlength: [100, 'Company name cannot be more than 100 characters'],
    },
    position: {
      type: String,
      trim: true,
      maxlength: [100, 'Position cannot be more than 100 characters'],
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    postalCode: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
      match: [
        /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/,
        'Please provide a valid URL',
      ],
    },
    socialMedia: [
      {
        platform: {
          type: String,
          required: true,
          enum: ['facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'tiktok', 'other'],
        },
        url: {
          type: String,
          required: true,
        },
      },
    ],
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    notes: {
      type: String,
      maxlength: [1000, 'Notes cannot be more than 1000 characters'],
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'lead', 'customer', 'influencer'],
      default: 'lead',
    },
    verificationStatus: {
      type: String,
      enum: ['unverified', 'pending', 'verified', 'failed'],
      default: 'unverified',
    },
    lastContacted: {
      type: Date,
    },
    nextFollowUp: {
      type: Date,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isFavorite: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add text index for search
ContactSchema.index(
  {
    firstName: 'text',
    lastName: 'text',
    email: 'text',
    company: 'text',
    position: 'text',
    'socialMedia.url': 'text',
    tags: 'text',
  },
  {
    weights: {
      firstName: 5,
      lastName: 5,
      email: 10,
      company: 3,
      position: 2,
    },
    name: 'contact_text_search',
  }
);

// Compound index for common queries
ContactSchema.index({ status: 1, verificationStatus: 1 });
ContactSchema.index({ createdBy: 1, isFavorite: 1 });

export default model<IContact>('Contact', ContactSchema);
