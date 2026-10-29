/**
 * Where three's Draco decoder is served from (public/draco/, copied from
 * three/examples/jsm/libs/draco/gltf). The machine models are Draco-compressed;
 * serving the decoder ourselves keeps the self-hosted build working offline
 * instead of fetching it from Google's CDN, drei's default.
 */
export const DRACO_DECODER = "/draco/";
