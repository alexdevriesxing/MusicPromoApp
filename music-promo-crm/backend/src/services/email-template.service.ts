import { Types } from 'mongoose';
import EmailTemplate, { IEmailTemplate } from '../models/email-template.model';
import { BadRequestError, NotFoundError } from '../errors';

interface CreateTemplateData {
  name: string;
  subject: string;
  body: string;
  variables: string[];
  previewText?: string;
  isDefault?: boolean;
  category?: string;
  thumbnail?: string;
}

interface UpdateTemplateData extends Partial<CreateTemplateData> {}

class EmailTemplateService {
  async createTemplate(
    userId: string,
    data: CreateTemplateData
  ): Promise<IEmailTemplate> {
    // Check if template with same name already exists
    const existingTemplate = await EmailTemplate.findOne({ name: data.name });
    if (existingTemplate) {
      throw new BadRequestError('A template with this name already exists');
    }

    const templateData = {
      ...data,
      createdBy: userId,
      updatedBy: userId,
      // Ensure only one default template per category
      isDefault: data.isDefault === true,
    };

    const template = await EmailTemplate.create(templateData);
    return template;
  }

  async updateTemplate(
    templateId: string,
    userId: string,
    data: UpdateTemplateData
  ): Promise<IEmailTemplate | null> {
    const template = await EmailTemplate.findById(templateId);
    if (!template) {
      throw new NotFoundError('Template not found');
    }

    // If name is being updated, check for duplicates
    if (data.name && data.name !== template.name) {
      const existingTemplate = await EmailTemplate.findOne({ name: data.name });
      if (existingTemplate) {
        throw new BadRequestError('A template with this name already exists');
      }
    }

    const updateData = {
      ...data,
      updatedBy: userId,
    };

    const updatedTemplate = await EmailTemplate.findByIdAndUpdate(
      templateId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    return updatedTemplate;
  }

  async getTemplateById(templateId: string): Promise<IEmailTemplate> {
    const template = await EmailTemplate.findById(templateId)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');
    
    if (!template) {
      throw new NotFoundError('Template not found');
    }
    
    return template;
  }

  async listTemplates(
    userId: string,
    options: {
      category?: string;
      isDefault?: boolean;
      page?: number;
      limit?: number;
      sort?: string;
    } = {}
  ): Promise<{ templates: IEmailTemplate[]; total: number }> {
    const { category, isDefault, page = 1, limit = 10, sort = '-updatedAt' } = options;
    
    const query: any = { createdBy: userId };
    
    if (category) {
      query.category = category;
    }
    
    if (isDefault !== undefined) {
      query.isDefault = isDefault;
    }
    
    const templates = await EmailTemplate.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');
      
    const total = await EmailTemplate.countDocuments(query);
    
    return { templates, total };
  }

  async deleteTemplate(templateId: string, userId: string): Promise<void> {
    const template = await EmailTemplate.findById(templateId);
    
    if (!template) {
      throw new NotFoundError('Template not found');
    }
    
    // Prevent deletion of default templates
    if (template.isDefault) {
      throw new BadRequestError('Cannot delete a default template');
    }
    
    await EmailTemplate.findByIdAndDelete(templateId);
  }

  async getTemplateCategories(userId: string): Promise<string[]> {
    const categories = await EmailTemplate.distinct('category', { createdBy: userId });
    return categories.filter(Boolean) as string[];
  }

  async getDefaultTemplate(category?: string): Promise<IEmailTemplate | null> {
    const query: any = { isDefault: true };
    
    if (category) {
      query.category = category;
    }
    
    return EmailTemplate.findOne(query);
  }

  async duplicateTemplate(
    templateId: string,
    userId: string,
    newName: string
  ): Promise<IEmailTemplate> {
    const template = await EmailTemplate.findById(templateId);
    if (!template) {
      throw new NotFoundError('Template not found');
    }

    // Check if a template with the new name already exists
    const existingTemplate = await EmailTemplate.findOne({ name: newName });
    if (existingTemplate) {
      throw new BadRequestError('A template with this name already exists');
    }

    // Create a new template with the same data but new name
    const newTemplate = new EmailTemplate({
      ...template.toObject(),
      _id: new Types.ObjectId(),
      name: newName,
      isDefault: false, // Duplicates should not be default
      createdBy: userId,
      updatedBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await newTemplate.save();
    return newTemplate;
  }
}

export default new EmailTemplateService();
