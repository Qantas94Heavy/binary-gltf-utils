'use strict';

const mimeTypeMap = new Map();
mimeTypeMap.set('image/png', getPngWidthHeight);
mimeTypeMap.set('image/jpeg', getJpegWidthHeight);
mimeTypeMap.set('image/gif', getGifWidthHeight);
mimeTypeMap.set('image/bmp', getBmpWidthHeight);

const INVALID_TYPE = 'Invalid MIME type. Supported MIME types are: ' +
                     Array.from(mimeTypeMap.keys()).join(', ');

/**
 * @param {Buffer} contents
 */
function getPngWidthHeight(contents) {
  // Check file contains the first 4 bytes of the PNG signature.
  if (contents.readUInt32BE(0) !== 0x89504E47) return null;

  const width = contents.readUInt32BE(16);
  const height = contents.readUInt32BE(20);
  return { width, height };
}

/********/
/* JPEG */
/********/

// Tables/misc header markers.
// DQT, DHT, DAC, DRI, COM, APP_n
const tableMarkers = new Set([ 0xFFDB, 0xFFC4, 0xFFCC, 0xFFDD, 0xFFFE ]);
for (let i = 0xFFE0; i < 0xFFF0; ++i) tableMarkers.add(i);

// SOF markers and DHP marker.
// These markers are after tables/misc data.
const sofMarkers = new Set(
[ 0xFFC0, 0xFFC1, 0xFFC2, 0xFFC3, 0xFFC5, 0xFFC6, 0xFFC7
, 0xFFC9, 0xFFCA, 0xFFCB, 0xFFCD, 0xFFCE, 0xFFCF, 0xFFDE
]);

/**
 * @param {Buffer} contents
 */
function getJpegWidthHeight(contents) {
  // Check file contains the JPEG "start of image" (SOI) marker.
  if (contents.readUInt16BE(0) !== 0xFFD8) return null;

  // Exclude the two byte SOI marker.
  let i = 2;
  while (i < contents.length) {
    const marker = contents.readUInt16BE(i);

    // The frame that contains the width and height of the JPEG image.
    if (sofMarkers.has(marker)) {
      // Number of lines.
      const height = contents.readUInt16BE(i + 5);
      // Number of pixels per line.
      const width = contents.readUInt16BE(i + 7);
      return { width, height };
    }

    // Miscellaneous tables/data preceding the frame header.
    if (tableMarkers.has(marker)) {
      // Length includes size of length parameter but not the two byte header.
      i += 2;
      i += contents.readUInt16BE(i);
    }
    // Not a valid marker.
    else return null;
  }

  return null;
}

/**
 * @param {Buffer} contents
 * FIXME: GIF is not this simple
 */
function getGifWidthHeight(contents) {
  // Check first 4 bytes of the GIF signature ("GIF8").
  if (contents.readUInt32BE(0) !== 0x47494638) return null;

  // GIF is little endian.
  const width = contents.readUInt16LE(6);
  const height = contents.readUInt16LE(8);
  return { width, height };
}

/**
 * @param {Buffer} contents
 * FIXME: BMP is not this simple
 */
function getBmpWidthHeight(contents) {
  // Check magic number is valid (first 2 characters should be "BM").
  if (contents.readUInt16BE(0) !== 0x424D) return null;

  // BMP is little endian.
  const width = contents.readUInt32LE(18);
  const height = contents.readUInt32LE(22);
  return { width, height };
}

/**
 * Sniffs the contents of a file to attempt to deduce the image type.
 * Supported image types are PNG, JPEG, GIF and BMP.
 *
 * @param {Buffer} contents
 * @param {string} [mimeType]
 */
function getWidthHeight(contents, mimeType) {
  // Looking for only a specific MIME type.
  if (mimeType) {
    const handler = mimeTypeMap.get(mimeType);
    if (!handler) throw new Error(INVALID_TYPE);

    const result = handler(contents);
    if (!result) throw new Error('invalid image for type: ' + mimeType);
    return result;
  }

  // Loop through each file type and see if they work.
  for (let [ mimeType, handler ] of mimeTypeMap.entries()) {
    const result = handler(contents);
    if (result) {
      result.mimeType = mimeType;
      return result;
    }
  }

  // Seems not :(
  throw new Error(INVALID_TYPE);
}

getWidthHeight.png = getPngWidthHeight;
getWidthHeight.jpeg = getJpegWidthHeight;
getWidthHeight.gif = getGifWidthHeight;
getWidthHeight.bmp = getBmpWidthHeight;
getWidthHeight.all = getWidthHeight;
module.exports = getWidthHeight;
