import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

/**
 * Returns allowed WebSocket origins based on NODE_ENV.
 *
 * In production, restricts to the known deployment domains.
 * In development, allows localhost origins so the frontend can connect.
 *
 * This mirrors the CORS policy configured in main.ts for the HTTP server.
 */
function getWebSocketCorsConfig(): { origin: string | string[]; credentials: boolean } {
  if (process.env.NODE_ENV === 'production') {
    return {
      origin: [
        'https://novalabs.vercel.app',
        'https://www.novalabs.vercel.app',
      ],
      credentials: true,
    };
  }

  return {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
    ],
    credentials: true,
  };
}

@WebSocketGateway({
  namespace: 'notifications',
  cors: getWebSocketCorsConfig(),
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        (client.handshake.auth?.token as string) ??
        (client.handshake.headers?.authorization as string)?.replace(
          'Bearer ',
          '',
        );

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify<{ sub: string }>(token, {
        secret: process.env.JWT_SECRET,
      });

      // Join a room named after the user ID so we can target them
      await client.join(`user:${payload.sub}`);
      this.logger.log(`Client connected: ${client.id} (user ${payload.sub})`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Push a notification event to a specific user.
   */
  sendToUser(userId: string, event: string, data: unknown): void {
    this.server.to(`user:${userId}`).emit(event, data);
  }
}
