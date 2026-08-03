export const loginRequestSchema = {
  type: 'object',
  required: ['callsign', 'password'],
  properties: {
    callsign: { type: 'string', maxLength: 20 },
    password: { type: 'string', maxLength: 128 },
  },
} as const;

export const loginResponseSchema = {
  type: 'object',
  properties: {
    accessToken: { type: 'string' },
    refreshToken: { type: 'string' },
    expiresIn: { type: 'number' },
  },
} as const;