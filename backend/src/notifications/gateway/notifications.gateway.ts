import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { resolveWsCorsConfigSafe } from '../../common/cors/cors-config';

// Resolve WS CORS from the same env as the HTTP API so a mis-deployed preview
// running on a non-allowed origin cannot subscribe either. In production
// this is parsed from CORS_ORIGINS (CSV); in development the safe wrapper
// degrades to deny-all on misconfiguration rather than throwing at module
// load, so unit tests that import this gateway do not need to pre-set env.
const wsCors = resolveWsCorsConfigSafe(
  process.env.NODE_ENV,
  process.env.CORS_ORIGINS,
);

@WebSocketGateway({
  namespace: 'notifications',
  cors: { origin: wsCors.origin },
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
