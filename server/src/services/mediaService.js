import ApiError from '../utils/ApiError.js';

const notConfigured = () => { throw new ApiError(501, 'Media storage provider is not configured'); };
export const uploadImage = notConfigured;
export const deleteImage = notConfigured;
export const getImageUrl = notConfigured;
