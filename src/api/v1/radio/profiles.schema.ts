export const createProfileSchema = {
  $id: 'createProfile',
  type: 'object',
  required: ['stationId', 'profileIndex', 'name', 'frequencyHz', 'mode'],
  properties: {
    stationId: { type: 'string', minLength: 1, maxLength: 128 },
    profileIndex: { type: 'integer', minimum: 0, maximum: 127 },
    name: { type: 'string', minLength: 1, maxLength: 128 },
    frequencyHz: { type: 'integer', minimum: 100_000, maximum: 30_000_000 },
    mode: { type: 'string', enum: ['USB', 'LSB', 'CW', 'AM', 'FM', 'DIGITAL'] },
    volume: { type: 'integer', minimum: 0, maximum: 100, default: 50 },
    bfoHz: { type: 'integer', default: 0 },
    digitalVoice: { type: 'integer', enum: [0, 1], default: 0 },
    powerLevel: { type: 'integer', nullable: true },
    isActive: { type: 'integer', enum: [0, 1], default: 0 },
  },
  additionalProperties: false,
} as const;

export const updateProfileSchema = {
  $id: 'updateProfile',
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 128 },
    frequencyHz: { type: 'integer', minimum: 100_000, maximum: 30_000_000 },
    mode: { type: 'string', enum: ['USB', 'LSB', 'CW', 'AM', 'FM', 'DIGITAL'] },
    volume: { type: 'integer', minimum: 0, maximum: 100 },
    bfoHz: { type: 'integer' },
    digitalVoice: { type: 'integer', enum: [0, 1] },
    powerLevel: { type: 'integer', nullable: true },
    isActive: { type: 'integer', enum: [0, 1] },
  },
  additionalProperties: false,
  minProperties: 1,
} as const;

export const profileResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    stationId: { type: 'string' },
    profileIndex: { type: 'integer' },
    name: { type: 'string' },
    frequencyHz: { type: 'integer' },
    mode: { type: 'string' },
    volume: { type: 'integer' },
    bfoHz: { type: 'integer' },
    digitalVoice: { type: 'integer' },
    powerLevel: { type: 'integer', nullable: true },
    isActive: { type: 'integer' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
} as const;