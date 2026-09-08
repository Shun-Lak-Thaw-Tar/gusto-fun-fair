import multer from 'multer';
import ApiError from '../utils/ApiError.js';

export const MAX_IMAGE_BYTES = 7 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 1, fieldSize: 2048, parts: 3 } }).single('image');
export const receiveImage = (req, res, next) => {
  upload(req, res, (error) => {
    if (error) return next(new ApiError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, error.code === 'LIMIT_FILE_SIZE' ? 'Image must be at most 7 MB' : 'Expected one image file and optional caption'));
    if (!req.file) return next(new ApiError(400, 'Send an image file using multipart/form-data field image'));
    next();
  });
};
