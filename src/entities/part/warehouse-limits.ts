/**
 * What one trainee may keep in the warehouse. Sized so a free Neon project
 * (0.5 GB) stays under half full with several hundred active trainees: a
 * part is a compressed distance field, typically 30–200 KB.
 */
export const MAX_PARTS_PER_USER = 30;
export const MAX_FIELD_BYTES = 768 * 1024;
export const MAX_PREVIEW_BYTES = 64 * 1024;
export const MAX_PROGRAM_CHARS = 100_000;
export const MAX_PART_NAME = 60;
