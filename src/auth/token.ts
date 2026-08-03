import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import jwt from 'jsonwebtoken';
import type { AppConfig } from '../shared/config.js';

export interface TokenPayload {
  sub: string;
  callsign: string;
  role: string;
  locale: string;
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  sub: string;
  type: string;
  jti: string;
  iat: number;
  exp: number;
}

export class TokenService {
  private readonly privateKey: string;
  private readonly publicKey: string;
  private readonly accessExpiresIn: number;
  private readonly refreshExpiresIn: number;

  constructor(
    config: Pick<AppConfig, 'jwtPrivateKeyPath' | 'jwtPublicKeyPath' | 'jwtAccessExpiresIn' | 'jwtRefreshExpiresIn'>,
  ) {
    this.privateKey = readFileSync(config.jwtPrivateKeyPath, 'utf8');
    this.publicKey = readFileSync(config.jwtPublicKeyPath, 'utf8');
    this.accessExpiresIn = config.jwtAccessExpiresIn;
    this.refreshExpiresIn = config.jwtRefreshExpiresIn;
  }

  signAccessToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
    const now = Math.floor(Date.now() / 1000);
    return jwt.sign({ ...payload, iat: now, exp: now + this.accessExpiresIn }, this.privateKey, { algorithm: 'RS256' });
  }

  signRefreshToken(sub: string): string {
    const now = Math.floor(Date.now() / 1000);
    return jwt.sign(
      { sub, type: 'refresh', jti: randomUUID(), iat: now, exp: now + this.refreshExpiresIn },
      this.privateKey,
      { algorithm: 'RS256' },
    );
  }

  verifyAccessToken(token: string): TokenPayload {
    return jwt.verify(token, this.publicKey, { algorithms: ['RS256'] }) as TokenPayload;
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    return jwt.verify(token, this.publicKey, { algorithms: ['RS256'] }) as RefreshTokenPayload;
  }
}
