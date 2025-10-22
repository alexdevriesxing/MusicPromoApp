import mongoose, { Document, Schema } from 'mongoose';
import { ContactStatus } from '../types/contact.types';

export interface IEmailTemplate {
  subject: string;
  body: string;
  variables: string[];
}

export interface ICampaignRecipient {
  contactId: mongoose.Types.ObjectId;
  email: string;
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';
  opens?: number;
  lastOpenedAt?: Date;
  clicks?: number;
  lastClickedAt?: Date;
  error?: string;
}

export interface ICampaign extends Document {
  name: string;
  description?: string;
  subject: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  template: IEmailTemplate;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'cancelled';
  scheduledAt?: Date;
  sentAt?: Date;
  completedAt?: Date;
  recipients: ICampaignRecipient[];
  recipientFilter?: {
    tags?: string[];
    statuses?: ContactStatus[];
    countries?: string[];
  };
  stats: {
    total: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    failed: number;
    openRate: number;
    clickRate: number;
  };
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const emailTemplateSchema = new Schema<IEmailTemplate>({
  subject: { type: String, required: true },
  body: { type: String, required: true },
  variables: [{ type: String }],
});

const campaignRecipientSchema = new Schema<ICampaignRecipient>({
  contactId: { type: Schema.Types.ObjectId, ref: 'Contact', required: true },
  email: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed'],
    default: 'pending',
  },
  opens: { type: Number, default: 0 },
  lastOpenedAt: { type: Date },
  clicks: { type: Number, default: 0 },
  lastClickedAt: { type: Date },
  error: { type: String },
}, { _id: false });

const campaignSchema = new Schema<ICampaign>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    subject: { type: String, required: true },
    fromEmail: { type: String, required: true },
    fromName: { type: String, required: true },
    replyTo: { type: String },
    template: { type: emailTemplateSchema, required: true },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'],
      default: 'draft',
    },
    scheduledAt: { type: Date },
    sentAt: { type: Date },
    completedAt: { type: Date },
    recipients: [campaignRecipientSchema],
    recipientFilter: {
      tags: [{ type: String }],
      statuses: [{
        type: String,
        enum: ['active', 'inactive', 'lead', 'customer', 'influencer'],
      }],
      countries: [{ type: String }],
    },
    stats: {
      total: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      opened: { type: Number, default: 0 },
      clicked: { type: Number, default: 0 },
      bounced: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      openRate: { type: Number, default: 0 },
      clickRate: { type: Number, default: 0 },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Indexes for better query performance
campaignSchema.index({ status: 1 });
campaignSchema.index({ scheduledAt: 1 });
campaignSchema.index({ 'recipients.contactId': 1 });
campaignSchema.index({ 'recipients.status': 1 });

// Pre-save hook to update stats
campaignSchema.pre('save', function (next) {
  if (this.isModified('recipients') || this.isNew) {
    const stats = {
      total: this.recipients.length,
      sent: this.recipients.filter(r => ['sent', 'delivered', 'opened', 'clicked', 'bounced'].includes(r.status)).length,
      delivered: this.recipients.filter(r => ['delivered', 'opened', 'clicked'].includes(r.status)).length,
      opened: this.recipients.filter(r => ['opened', 'clicked'].includes(r.status)).length,
      clicked: this.recipients.filter(r => r.status === 'clicked').length,
      bounced: this.recipients.filter(r => r.status === 'bounced').length,
      failed: this.recipients.filter(r => r.status === 'failed').length,
    };

    this.stats = {
      ...stats,
      openRate: stats.delivered > 0 ? Math.round((stats.opened / stats.delivered) * 100) : 0,
      clickRate: stats.delivered > 0 ? Math.round((stats.clicked / stats.delivered) * 100) : 0,
    };
  }
  next();
});

const Campaign = mongoose.model<ICampaign>('Campaign', campaignSchema);

export default Campaign;
