import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../users/entities/user.entity';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { PasskeyController } from './passkey.controller';
import { PasskeyService } from './passkey.service';
import { UserHelper } from '../helper/user-helper';
import { JwtHelper } from '../helper/jwt-helper';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') ?? 'dev-secret',
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRATION') ??
            '7d') as any,
        },
      }),
    }),
    PassportModule,
  ],
  controllers: [PasskeyController],
  providers: [PasskeyService, UserHelper, JwtHelper],
  exports: [PasskeyService],
})
export class PasskeyModule {}
