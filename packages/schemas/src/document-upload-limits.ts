/** Decoded file bytes, not base64 characters or binary MiB. */
export const DOCUMENT_UPLOAD_MAX_BYTES = 10_000_000;
export const IMPORT_UPLOAD_MAX_BYTES = 20_000_000;

export const DOCUMENT_UPLOAD_MAX_BASE64_CHARACTERS = Math.ceil(DOCUMENT_UPLOAD_MAX_BYTES / 3) * 4;
export const IMPORT_UPLOAD_MAX_BASE64_CHARACTERS = Math.ceil(IMPORT_UPLOAD_MAX_BYTES / 3) * 4;

/** Physical JSON bytes: encoded file plus bounded metadata. */
export const DOCUMENT_UPLOAD_MAX_JSON_BYTES = DOCUMENT_UPLOAD_MAX_BASE64_CHARACTERS + 131_072;
export const IMPORT_UPLOAD_MAX_JSON_BYTES = IMPORT_UPLOAD_MAX_BASE64_CHARACTERS + 131_072;
