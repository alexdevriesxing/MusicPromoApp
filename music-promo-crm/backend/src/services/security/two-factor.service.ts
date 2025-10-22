import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { prisma } from '../../../prisma';
import { logger } from '../../utils/logger';

export const twoFactorService = {
  /**
   * Generate a new 2FA secret for a user
   */
  async generateSecret(userId: string, email: string) {
    try {
      const secret = speakeasy.generateSecret({
        name: `MusicPromoCRM:${email}`,
        length: 20
      });

      // Save the secret to the user's account
      await prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorSecret: secret.base32,
          twoFactorEnabled: false
        }
      });

      // Generate a QR code URL for the authenticator app
      const otpAuthUrl = speakeasy.otpauthURL({
        secret: secret.base32,
        label: encodeURIComponent(`MusicPromoCRM:${email}`),
        issuer: 'MusicPromoCRM',
        encoding: 'base32'
      });

      // Generate QR code data URL
      const qrCodeUrl = await qrcode.toDataURL(otpAuthUrl);

      return {
        secret: secret.base32,
        otpAuthUrl,
        qrCodeUrl
      };
    } catch (error) {
      logger.error('Error generating 2FA secret:', error);
      throw new Error('Failed to generate 2FA secret');
    }
  },

  /**
   * Verify a 2FA token for a user
   */
  async verifyToken(userId: string, token: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { twoFactorSecret: true }
      });

      if (!user?.twoFactorSecret) {
        throw new Error('2FA not set up for this user');
      }

      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token,
        window: 1 // Allow tokens from the previous and next 30-second window
      });

      return verified;
    } catch (error) {
      logger.error('Error verifying 2FA token:', error);
      throw new Error('Failed to verify 2FA token');
    }
  },

  /**
   * Enable 2FA for a user after they've verified their first token
   */
  async enable2FA(userId: string) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { twoFactorEnabled: true }
      });
      return true;
    } catch (error) {
      logger.error('Error enabling 2FA:', error);
      throw new Error('Failed to enable 2FA');
    }
  },

  /**
   * Disable 2FA for a user
   */
  async disable2FA(userId: string) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { 
          twoFactorSecret: null,
          twoFactorEnabled: false,
          // Generate backup codes when disabling 2FA
          twoFactorBackupCodes: {
            create: this.generateBackupCodes()
          }
        }
      });
      return true;
    } catch (error) {
      logger.error('Error disabling 2FA:', error);
      throw new Error('Failed to disable 2FA');
    }
  },

  /**
   * Generate backup codes for 2FA
   */
  generateBackupCodes() {
    const codes = [];
    for (let i = 0; i < 10; i++) {
      codes.push({
        code: this.generateRandomCode(10),
        used: false
      });
    }
    return codes;
  },

  /**
   * Verify a backup code
   */
  async verifyBackupCode(userId: string, code: string) {
    try {
      const backupCode = await prisma.twoFactorBackupCode.findFirst({
        where: {
          userId,
          code,
          used: false
        }
      });

      if (!backupCode) {
        return false;
      }

      // Mark the code as used
      await prisma.twoFactorBackupCode.update({
        where: { id: backupCode.id },
        data: { used: true, usedAt: new Date() }
      });

      return true;
    } catch (error) {
      logger.error('Error verifying backup code:', error);
      return false;
    }
  },

  /**
   * Generate a random alphanumeric code
   */
  private generateRandomCode(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
};

export default twoFactorService;
