export const refreshRequestSchema = {
  type: 'object',
  required: ['refreshToken'],
  properties: {
    refreshToken: { type: 'string' },
  },
} as const;

export const refreshResponseSchema = {
  type: 'object',
  properties: {
    accessToken: { type: 'string' },
    refreshToken: { type: 'string' },
    expiresIn: { type: 'number' },
  },
} as const;