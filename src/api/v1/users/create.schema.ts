export const createUserRequestSchema = {
  type: 'object',
  required: ['callsign', 'displayName', 'password'],
  properties: {
    callsign: { type: 'string', maxLength: 20, minLength: 1 },
    displayName: { type: 'string', maxLength: 100, minLength: 1 },
    password: { type: 'string', maxLength: 128, minLength: 8 },
    email: { type: 'string', maxLength: 254, format: 'email' },
    role: { type: 'string', enum: ['admin', 'operator', 'user', 'readonly'] },
    locale: { type: 'string', enum: ['en', 'es', 'pt-BR'] },
  },
  additionalProperties: false,
} as const;