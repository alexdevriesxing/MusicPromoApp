import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';
import Contact from '../models/contact.model';
import { BadRequestError, NotFoundError } from '../errors';

// This uses the extended types from src/types/express/index.d.ts

export const createContact = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new BadRequestError('Validation error', errors.array());
  }

  const contactData = {
    ...req.body,
    createdBy: req.user?.userId,
    updatedBy: req.user?.userId,
  };

  const contact = await Contact.create(contactData);
  
  res.status(StatusCodes.CREATED).json({
    status: 'success',
    data: {
      contact,
    },
  });
};

export const getContacts = async (req: Request, res: Response) => {
  const {
    search,
    status,
    verificationStatus,
    tags,
    country,
    isFavorite,
    sort = '-createdAt',
    page = 1,
    limit = 10,
  } = req.query;

  const query: any = { createdBy: req.user?.userId };

  // Search
  if (search) {
    query.$text = { $search: search as string };
  }

  // Filter by status
  if (status) {
    query.status = status;
  }

  // Filter by verification status
  if (verificationStatus) {
    query.verificationStatus = verificationStatus;
  }

  // Filter by tags
  if (tags) {
    const tagsArray = (tags as string).split(',');
    query.tags = { $all: tagsArray };
  }

  // Filter by country
  if (country) {
    query.country = country;
  }

  // Filter by favorite
  if (isFavorite) {
    query.isFavorite = isFavorite === 'true';
  }

  // Execute query
  const contactsQuery = Contact.find(query)
    .sort(sort as string)
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));

  const [contacts, total] = await Promise.all([
    contactsQuery,
    Contact.countDocuments(query),
  ]);

  res.status(StatusCodes.OK).json({
    status: 'success',
    results: contacts.length,
    total,
    data: {
      contacts,
    },
  });
};

export const getContact = async (req: Request, res: Response) => {
  const { id } = req.params;

  const contact = await Contact.findOne({
    _id: id,
    createdBy: req.user?.userId,
  });

  if (!contact) {
    throw new NotFoundError(`No contact found with id: ${id}`);
  }

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      contact,
    },
  });
};

export const updateContact = async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new BadRequestError('Validation error', errors.array());
  }

  const { id } = req.params;
  
  const contact = await Contact.findOneAndUpdate(
    { _id: id, createdBy: req.user?.userId },
    { ...req.body, updatedBy: req.user?.userId },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!contact) {
    throw new NotFoundError(`No contact found with id: ${id}`);
  }

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      contact,
    },
  });
};

export const deleteContact = async (req: Request, res: Response) => {
  const { id } = req.params;

  const contact = await Contact.findOneAndDelete({
    _id: id,
    createdBy: req.user?.userId,
  });

  if (!contact) {
    throw new NotFoundError(`No contact found with id: ${id}`);
  }

  res.status(StatusCodes.NO_CONTENT).json({
    status: 'success',
    data: null,
  });
};

export const toggleFavorite = async (req: Request, res: Response) => {
  const { id } = req.params;

  const contact = await Contact.findOne({
    _id: id,
    createdBy: req.user?.userId,
  });

  if (!contact) {
    throw new NotFoundError(`No contact found with id: ${id}`);
  }

  contact.isFavorite = !contact.isFavorite;
  contact.updatedBy = req.user?.userId as any;
  await contact.save();

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      contact,
    },
  });
};

export const verifyContact = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['pending', 'verified', 'failed'].includes(status)) {
    throw new BadRequestError('Invalid verification status');
  }

  const contact = await Contact.findOneAndUpdate(
    { _id: id, createdBy: req.user?.userId },
    { 
      verificationStatus: status,
      updatedBy: req.user?.userId,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!contact) {
    throw new NotFoundError(`No contact found with id: ${id}`);
  }

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      contact,
    },
  });
};

export const getContactStats = async (req: Request, res: Response) => {
  const stats = await Contact.aggregate([
    {
      $match: { createdBy: new mongoose.Types.ObjectId(req.user?.userId) }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      stats,
    },
  });
};
