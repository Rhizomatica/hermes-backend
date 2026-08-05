/**
 * JSON Field Validator
 * ====================
 *
 * Validates that TEXT columns storing JSON (metadata, headers, to_addresses, etc.)
 * contain valid JSON strings before insertion/update. Throws early to prevent
 * corrupt data from reaching the database.
 *
 * Schema DDL already provides `DEFAULT '{}'` for most columns, so null/empty values
 * are handled by the column default — this validator only checks values that are
 * explicitly provided.
 */

/**
 * Validate that a value is a valid JSON string.
 *
 * @param fieldName Human-readable field identifier for error messages (e.g., "messages.metadata")
 * @param value The string to validate
 * @throws {Error} if the value is not valid JSON
 */
export function validateJsonField(fieldName: string, value: string): void {
  try {
    JSON.parse(value);
  } catch {
    throw new Error(
      `Invalid JSON in ${fieldName}: value is not a valid JSON string. ` +
      `Received: ${value.slice(0, 100)}${value.length > 100 ? '...' : ''}`,
    );
  }
}

/**
 * Validate that a value is a valid JSON array string (e.g., to_addresses, cc_addresses).
 *
 * @param fieldName Human-readable field identifier for error messages
 * @param value The string to validate
 * @throws {Error} if the value is not a valid JSON array
 */
export function validateJsonArrayField(fieldName: string, value: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(
      `Invalid JSON in ${fieldName}: value is not a valid JSON string. ` +
      `Received: ${value.slice(0, 100)}${value.length > 100 ? '...' : ''}`,
    );
  }
  if (!Array.isArray(parsed)) {
    throw new Error(
      `Invalid JSON in ${fieldName}: expected a JSON array. ` +
      `Received type: ${typeof parsed}`,
    );
  }
}