import { Types } from 'mongoose';

declare global {
  namespace Express {
    interface User {
      userId: Types.ObjectId;
      name: string;
      role: string;
    }

    interface Request {
      user?: User;
    }
  }
}
