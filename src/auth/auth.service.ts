import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { Repository } from 'typeorm';
import { EnvironmentVariables } from '../interfaces/environmentVariables';
import { AuthInfo } from './entities/authInfo.entity';

type TwitchAuthResult = {
  access_token: string;
  /**
   * Time in seconds.
   */
  expires_in: number;
  token_type: string;
};

type AuthHeaders = {
  'Client-ID': string;
  Authorization: string;
};

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AuthInfo)
    private readonly authRepository: Repository<AuthInfo>,
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  async getAuthHeaders(): Promise<AuthHeaders> {
    const existingAuth = await this.authRepository.findOne();
    if (!this.isAuthValid(existingAuth)) {
      console.info('🔐 Getting new auth info from Twitch.');
      const requestDate = new Date();
      const newAuth = await this.authenticateViaTwitch(
        this.configService.get<string>('TWITCH_CLIENT_ID'),
        this.configService.get<string>('TWITCH_CLIENT_SECRET'),
      );
      if (existingAuth) {
        await this.authRepository.remove(existingAuth);
      }
      requestDate.setSeconds(requestDate.getSeconds() + newAuth.expires_in);
      await this.authRepository.save({
        authToken: newAuth.access_token,
        expiryDate: requestDate.toISOString(),
      });
      return this.tokenToAuthHeaders(newAuth.access_token);
    }
    return this.tokenToAuthHeaders(existingAuth.authToken);
  }

  private tokenToAuthHeaders(token: string): AuthHeaders {
    return {
      'Client-ID': this.configService.get<string>('TWITCH_CLIENT_ID'),
      Authorization: `Bearer ${token}`,
    };
  }

  private isAuthValid(authInfo?: AuthInfo): boolean {
    const now = new Date();
    return authInfo && now < new Date(authInfo.expiryDate);
  }

  private async authenticateViaTwitch(
    clientId: string,
    clientSecret: string,
  ): Promise<TwitchAuthResult> {
    const { data } = await axios.post<TwitchAuthResult>(
      `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    );
    return data;
  }
}
