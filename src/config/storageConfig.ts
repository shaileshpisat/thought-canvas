/**
 * Storage configuration for Black Board.
 *
 * STORAGE_LIMIT_BYTES — the maximum amount of browser storage this app is
 * allowed to consume (across localStorage + IndexedDB combined, as reported
 * by navigator.storage.estimate()).
 *
 * Set to `null` to use the browser's full available quota with no
 * application-level cap (useful during local development).
 *
 * For a public deployment you should set an explicit cap so that individual
 * users cannot accidentally consume all available disk space. A value of
 * 50 MB (50 * 1024 * 1024) is a reasonable default for an app that stores
 * images locally.
 *
 * STORAGE_WARN_THRESHOLD — fraction of STORAGE_LIMIT_BYTES (or the browser
 * quota when no limit is set) at which the user sees a "storage almost full"
 * warning. Default: 0.9 (90 %).
 */

export const STORAGE_LIMIT_BYTES: number | null = 50 * 1024 * 1024; // 50 MB

export const STORAGE_WARN_THRESHOLD = 0.9; // 90 %
