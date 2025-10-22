import { Server as HttpServer } from 'http';
import { Server as WsServer, WebSocket } from 'ws';
import { verify } from 'jsonwebtoken';
import { prisma } from '../../../prisma';
import { logger } from '../../utils/logger';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive: boolean;
}

export class WebSocketService {
  private static instance: WebSocketService;
  private wss: WsServer;
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  private pingInterval: NodeJS.Timeout;

  private constructor(server: HttpServer) {
    this.wss = new WsServer({ 
      server,
      clientTracking: true,
      // Increase the maximum payload size to 1MB
      maxPayload: 1024 * 1024,
    });

    this.setupEventHandlers();
    this.startHeartbeat();
  }

  public static getInstance(server?: HttpServer): WebSocketService {
    if (!WebSocketService.instance && server) {
      WebSocketService.instance = new WebSocketService(server);
    } else if (!WebSocketService.instance) {
      throw new Error('WebSocketService must be initialized with an HTTP server first');
    }
    return WebSocketService.instance;
  }

  private setupEventHandlers() {
    this.wss.on('connection', async (ws: AuthenticatedWebSocket, req) => {
      try {
        // Authenticate the WebSocket connection
        const token = this.getTokenFromRequest(req);
        if (!token) {
          ws.close(1008, 'Authentication token required');
          return;
        }

        const decoded = this.verifyToken(token);
        if (!decoded?.id) {
          ws.close(1008, 'Invalid token');
          return;
        }

        // Add user to the clients map
        ws.userId = decoded.id;
        ws.isAlive = true;

      } catch (error) {
        logger.error('WebSocket connection error:', error);
        ws.close(1011, 'Internal server error');
      }
    });

    // Handle WebSocket errors
    this.wss.on('error', (error) => {
      logger.error('WebSocket server error:', error);
    });
  }

  private startHeartbeat() {
    // Send ping every 30 seconds
    this.pingInterval = setInterval(() => {
      this.wss.clients.forEach((ws: AuthenticatedWebSocket) => {
        if (ws.isAlive === false) {
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping(() => {});
      });
    }, 30000);
  }

  private getTokenFromRequest(req: any): string | null {
    // Try to get token from query params
    if (req.url) {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      if (token) return token;
    }

    // Try to get token from headers
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.split(' ')[1];
    }

    return null;
  }

  private verifyToken(token: string): { id: string } | null {
    try {
      return verify(token, process.env.JWT_SECRET || 'your_jwt_secret') as { id: string };
    } catch (error) {
      return null;
    }
  }

  /**
   * Send a notification to a specific user
   */
  public sendToUser(userId: string, event: string, data: any) {
    if (!this.wss) return;

    const message = JSON.stringify({ event, data });
    
    this.wss.clients.forEach((client: AuthenticatedWebSocket) => {
      if (client.readyState === WebSocket.OPEN && client.userId === userId) {
        client.send(message);
      }
    });
  }

  /**
   * Broadcast a notification to all connected clients
   */
  public broadcast(event: string, data: any, excludeUserIds: string[] = []) {
    if (!this.wss) return;

    const message = JSON.stringify({ event, data });
    
    this.wss.clients.forEach((client: AuthenticatedWebSocket) => {
      if (
        client.readyState === WebSocket.OPEN && 
        (!client.userId || !excludeUserIds.includes(client.userId))
      ) {
        client.send(message);
      }
    });
  }

  /**
   * Clean up resources
   */
  public cleanup() {
    clearInterval(this.pingInterval);
    this.wss.close();
  }
}

export let webSocketService: WebSocketService;

export const initWebSocketService = (server: HttpServer) => {
  webSocketService = WebSocketService.getInstance(server);
  return webSocketService;
};
