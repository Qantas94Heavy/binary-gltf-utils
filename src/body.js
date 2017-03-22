'use strict';

const fs = require('fs');
const path = require('path');
const Promise = require('bluebird');
const parseDataUri = require('./parse-data-uri.js');

function padTo4Bytes(x) {
  // jshint bitwise:false
  return (x + 3) & ~3;
}

// TODO: padding of multiple of 4 bytes
class Body {
  constructor(containingFolder) {
    if (!containingFolder) throw new TypeError('missing container folder');
    this.containingFolder = containingFolder;

    // Lets us keep track of how large the body will be, as well as the offset for each of the
    // original buffers.
    this.length = 0;
    // [ offset_0, contents_0, offset_1, contents_1, ..., offset_n, contents_n ]
    this.parts = [];
  }
  add(uri, len) {
    return getBufferFromUri(uri, this.containingFolder).then(obj => {
      let buffer = obj.buffer;
      // We need to ensure the buffer is the same length as the original reference.
      if (Number.isFinite(len)) {
        len = Math.min(len, buffer.length);
        buffer = buffer.slice(0, len);
      }
      else len = buffer.length;

      // Write offset from the start of the binary body.
      const offset = this.length;

      // Add this buffer to the list of buffers to be written to the body.
      this.parts.push(offset, buffer);

      // We've now written the contents to the body, so it's longer now.
      this.length += len;
      return { offset, buffer };
    });
  }
  createGlb(scene) {
    if (!scene.buffers) scene.buffers = {};

    const bodyLength = this.length;
    scene.buffers.binary_glTF = { byteLength: bodyLength, uri: '' };

    const newSceneStr = JSON.stringify(scene);
    const contentLength = Buffer.byteLength(newSceneStr);
    // As body is 4-byte aligned, the scene length must be padded to have a multiple of 4.
    const paddedContentLength = padTo4Bytes(contentLength);

    // Header is 20 bytes long.
    const bodyOffset = paddedContentLength + 20;
    const fileLength = bodyOffset + bodyLength;

    // Let's create our GLB file!
    const glbFile = Buffer.alloc(fileLength);

    // Magic number (the ASCII string 'glTF').
    glbFile.writeUInt32BE(0x676C5446, 0);

    // Binary GLTF is little endian.
    // Version of the Binary glTF container format as a uint32 (version 1).
    glbFile.writeUInt32LE(1, 4);

    // Total length of the generated file in bytes (uint32).
    glbFile.writeUInt32LE(fileLength, 8);

    // Total length of the scene in bytes (uint32).
    glbFile.writeUInt32LE(paddedContentLength, 12);

    // Scene format as a uint32 (JSON is 0).
    glbFile.writeUInt32LE(0, 16);

    // Write the scene.
    glbFile.write(newSceneStr, 20);

    // Add spaces as padding to ensure scene is a multiple of 4 bytes.
    for (let i = contentLength + 20; i < bodyOffset; ++i) glbFile[i] = 0x20;

    // Write the body.
    for (let i = 0; i < this.parts.length; i += 2) {
      const offset = this.parts[i];
      const contents = this.parts[i + 1];
      contents.copy(glbFile, bodyOffset + offset);
    }

    return glbFile;
  }
}

function getBufferFromUri(uri, containingFolder) {
  // We need to use Promise.resolve as this would otherwise be synchronous.
  if (uri.startsWith('data:')) return Promise.resolve(parseDataUri(uri));
  return fs.readFileAsync(path.join(containingFolder, uri)).then(buffer => ({ buffer }));
}

module.exports = Body;
