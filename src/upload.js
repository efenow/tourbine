const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/ogg': '.ogg',
  'video/quicktime': '.mov'
};

function detectMediaExtension(buffer) {
  if (!buffer || buffer.length < 4) return null;
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return '.jpg';
  if (buffer.subarray(0, 8).equals(Buffer.from('\x89PNG\r\n\x1a\n', 'binary'))) return '.png';
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return '.webp';
  if (buffer.subarray(0, 4).toString() === 'OggS') return '.ogg';
  if (buffer.subarray(0, 4).toString() === '\x1a\x45\xdf\xa3') return '.webm';
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString() === 'ftyp') {
    return buffer.subarray(8, 12).toString() === 'qt  ' ? '.mov' : '.mp4';
  }
  return null;
}

function isValidMediaBuffer(buffer, mimetype) {
  const detected = detectMediaExtension(buffer);
  return detected && EXTENSIONS[mimetype] === detected;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, process.env.UPLOADS_DIR || path.resolve(__dirname, '..', 'public', 'uploads')),
  filename: (req, file, cb) => {
    const ext = EXTENSIONS[file.mimetype];
    cb(null, crypto.randomBytes(12).toString('hex') + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime'
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, WebP images and MP4, WebM, OGG, MOV videos are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }
});

upload.detectMediaExtension = detectMediaExtension;
upload.isValidMediaBuffer = isValidMediaBuffer;

module.exports = upload;
