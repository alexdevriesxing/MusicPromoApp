import { Request, Response } from 'express';
import User from '../models/user.model';
import { BadRequestError, UnauthenticatedError } from '../errors';
import { StatusCodes } from 'http-status-codes';

export const register = async (req: Request, res: Response) => {
  const { name, email, password } = req.body;

  // Check if user already exists
  const emailAlreadyExists = await User.findOne({ email });
  if (emailAlreadyExists) {
    throw new BadRequestError('Email already in use');
  }

  // Create first account as admin, rest as user
  const isFirstAccount = (await User.countDocuments({})) === 0;
  const role = isFirstAccount ? 'admin' : 'user';

  const user = await User.create({ name, email, password, role });
  
  // Generate token
  const token = user.createJWT();
  
  res.status(StatusCodes.CREATED).json({
    user: {
      name: user.name,
      email: user.email,
      role: user.role,
    },
    token,
  });
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new BadRequestError('Please provide email and password');
  }

  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw new UnauthenticatedError('Invalid credentials');
  }

  const isPasswordCorrect = await user.comparePassword(password);
  if (!isPasswordCorrect) {
    throw new UnauthenticatedError('Invalid credentials');
  }

  const token = user.createJWT();
  
  res.status(StatusCodes.OK).json({
    user: {
      name: user.name,
      email: user.email,
      role: user.role,
    },
    token,
  });
};

export const getCurrentUser = async (req: Request, res: Response) => {
  const user = await User.findById(req.user?.userId).select('-password');
  res.status(StatusCodes.OK).json({ user });
};
