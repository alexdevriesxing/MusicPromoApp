import { Request, Response } from 'express';
import { twoFactorService } from '../services/security/two-factor.service';
import { logger } from '../utils/logger';
import { requireAuth } from '../middleware/auth.middleware';

class TwoFactorController {
  /**
   * Generate a new 2FA secret and QR code
   */
  generate2FASecret = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      const userEmail = req.user?.email;

      if (!userId || !userEmail) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const result = await twoFactorService.generateSecret(userId, userEmail);
      
      res.json({
        success: true,
        data: {
          secret: result.secret,
          qrCodeUrl: result.qrCodeUrl,
          otpAuthUrl: result.otpAuthUrl
        }
      });
    } catch (error: any) {
      logger.error('Error generating 2FA secret:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate 2FA secret'
      });
    }
  };

  /**
   * Verify 2FA token and enable 2FA if valid
   */
  verify2FAToken = async (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      if (!token) {
        return res.status(400).json({ message: 'Token is required' });
      }

      const isValid = await twoFactorService.verifyToken(userId, token);

      if (!isValid) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid token' 
        });
      }

      // Enable 2FA for the user
      await twoFactorService.enable2FA(userId);

      res.json({ 
        success: true, 
        message: '2FA enabled successfully' 
      });
    } catch (error: any) {
      logger.error('Error verifying 2FA token:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to verify 2FA token'
      });
    }
  };

  /**
   * Disable 2FA for the current user
   */
  disable2FA = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      await twoFactorService.disable2FA(userId);

      res.json({ 
        success: true, 
        message: '2FA disabled successfully' 
      });
    } catch (error: any) {
      logger.error('Error disabling 2FA:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to disable 2FA'
      });
    }
  };

  /**
   * Generate new backup codes for 2FA
   */
  generateBackupCodes = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // Disable and re-enable 2FA to generate new backup codes
      await twoFactorService.disable2FA(userId);
      
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { twoFactorBackupCodes: true }
      });

      res.json({ 
        success: true, 
        data: {
          backupCodes: user?.twoFactorBackupCodes
            .filter(code => !code.used)
            .map(code => code.code)
        }
      });
    } catch (error: any) {
      logger.error('Error generating backup codes:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate backup codes'
      });
    }
  };

  /**
   * Verify a backup code
   */
  verifyBackupCode = async (req: Request, res: Response) => {
    try {
      const { code } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      if (!code) {
        return res.status(400).json({ message: 'Backup code is required' });
      }

      const isValid = await twoFactorService.verifyBackupCode(userId, code);

      if (!isValid) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid backup code' 
        });
      }

      res.json({ 
        success: true, 
        message: 'Backup code verified successfully' 
      });
    } catch (error: any) {
      logger.error('Error verifying backup code:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to verify backup code'
      });
    }
  };

  /**
   * Middleware to check if 2FA is required for the current user
   */
  require2FA = (req: Request, res: Response, next: any) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Check if 2FA is required for this user
    // This would typically check user preferences or admin settings
    const is2FARequired = user.requires2FA || false;
    
    if (is2FARequired && !user.twoFactorEnabled) {
      return res.status(403).json({ 
        success: false,
        code: '2FA_REQUIRED',
        message: 'Two-factor authentication is required for this account'
      });
    }

    next();
  };
}

export const twoFactorController = new TwoFactorController();
