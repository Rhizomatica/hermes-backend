import { describe, it, expect } from 'vitest';
import { validateJsonField, validateJsonArrayField } from '../../../src/shared/json-validator.js';

describe('validateJsonField', () => {
  it('should not throw for valid JSON object', () => {
    expect(() => validateJsonField('test', '{"key":"value"}')).not.toThrow();
  });

  it('should not throw for valid JSON array', () => {
    expect(() => validateJsonField('test', '[1, 2, 3]')).not.toThrow();
  });

  it('should not throw for valid JSON primitive', () => {
    expect(() => validateJsonField('test', '"hello"')).not.toThrow();
    expect(() => validateJsonField('test', '42')).not.toThrow();
    expect(() => validateJsonField('test', 'true')).not.toThrow();
    expect(() => validateJsonField('test', 'null')).not.toThrow();
  });

  it('should not throw for empty object', () => {
    expect(() => validateJsonField('test', '{}')).not.toThrow();
  });

  it('should throw for invalid JSON', () => {
    expect(() => validateJsonField('test.field', 'not-json')).toThrow(
      'Invalid JSON in test.field',
    );
  });

  it('should throw for unquoted strings', () => {
    expect(() => validateJsonField('test', 'unquoted')).toThrow(
      'Invalid JSON in test',
    );
  });

  it('should include truncated value in error message for long input', () => {
    const longInvalid = 'a'.repeat(200);
    expect(() => validateJsonField('test.long', longInvalid)).toThrow(
      /Invalid JSON in test\.long/,
    );
    // The message should contain truncated value (first 100 chars + "...")
    expect(() => validateJsonField('test.long', longInvalid)).toThrow(
      /\.\.\./,
    );
  });

  it('should throw with descriptive field name', () => {
    expect(() => validateJsonField('messages.metadata', 'bad')).toThrow(
      'Invalid JSON in messages.metadata',
    );
    expect(() => validateJsonField('conversations.metadata', 'bad')).toThrow(
      'Invalid JSON in conversations.metadata',
    );
  });
});

describe('validateJsonArrayField', () => {
  it('should not throw for valid JSON array', () => {
    expect(() => validateJsonArrayField('test', '["a", "b"]')).not.toThrow();
  });

  it('should not throw for empty JSON array', () => {
    expect(() => validateJsonArrayField('test', '[]')).not.toThrow();
  });

  it('should throw for JSON object (not array)', () => {
    expect(() => validateJsonArrayField('test.field', '{"key":"value"}')).toThrow(
      'Invalid JSON in test.field: expected a JSON array',
    );
  });

  it('should throw for JSON primitive (not array)', () => {
    expect(() => validateJsonArrayField('test.field', '42')).toThrow(
      'Invalid JSON in test.field: expected a JSON array',
    );
  });

  it('should throw for invalid JSON syntax', () => {
    expect(() => validateJsonArrayField('test.field', 'not-json')).toThrow(
      'Invalid JSON in test.field',
    );
  });

  it('should throw with descriptive field name in array validation', () => {
    expect(() => validateJsonArrayField('envelopes.to_addresses', '{}')).toThrow(
      'Invalid JSON in envelopes.to_addresses: expected a JSON array',
    );
  });
});