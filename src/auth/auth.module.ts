import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthInfo } from './entities/authInfo.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AuthInfo]), ConfigModule],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
