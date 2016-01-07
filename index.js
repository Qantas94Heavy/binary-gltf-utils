#!/usr/bin/env node

'use strict';

const Promise = require('bluebird');
const path = require('path');
const util = require('util');
const fs = Promise.promisifyAll(require('fs'));

const embedArr = [ 'textures', 'shaders' ];
const embed = {};

const argv = require('yargs')
  .usage('Usage: $0 <file> [options]')
  .demand(1)
  .array('embed')
  .describe('e', 'embeds textures or shaders into binary GLTF file')
  .choices('e', embedArr)
  .alias('e', 'embed')
  .boolean('cesium')
  .describe('cesium', 'sets the old body buffer name for compatibility with Cesium')
  .help('h')
  .alias('h', 'help')
  .argv;

if (argv.embed) {
  // If just specified as --embed, embed all types into body.
  const arr = argv.embed.length ? argv.embed : embedArr;

  // Enable the specific type of resource to be embedded.
  arr.forEach(function (type) {
    embed[type] = true;
  });
}

const filename = argv._[0];

if (!filename.endsWith('.gltf')) {
  console.error('Failed to create binary GLTF file:');
  console.error('----------------------------------');
  console.error('File specified does not have the .gltf extension.');
  return;
}

fs.readFileAsync(filename, 'utf-8').then(function (gltf) {
  // Modify the GLTF data to reference the buffer in the body instead of external references.
  const scene = JSON.parse(gltf);

  // Let a GLTF parser know that it is using the Binary GLTF extension.
  if (Array.isArray(scene.extensionsUsed)) scene.extensionsUsed.push('KHR_binary_glTF');
  else scene.extensionsUsed = [ 'KHR_binary_glTF' ];

  // All buffer views will later reference the implicit "binary_glTF" body buffer, so it will not
  // be needed.  We keep a reference to these old buffer definitions to create the body.
  const buffers = scene.buffers;

  // We can now remove the existing buffer definitions from the generated scene content.
  scene.buffers = undefined;

  // Lets us keep track of how large the body will be, as well as the offset for each of the
  // original buffers.
  let bodyLength = 0;

  Object.keys(buffers).forEach(function (bufferId) {
    const bufferInfo = buffers[bufferId];

    // We don't know how to deal with other types of buffers yet.
    const type = bufferInfo.type;

    if (type && type !== 'arraybuffer') {
      throw new Error(util.format('buffer type "%s" not supported: %s', type, bufferId));
    }

    // Set the buffer value to the offset temporarily for easier manipulation of bufferViews.
    bufferInfo.byteOffset = bodyLength;

    // Add the length of this buffer to how long body will be.
    bodyLength += bufferInfo.byteLength;
  });

  Object.keys(scene.bufferViews).forEach(function (bufferViewId) {
    const bufferView = scene.bufferViews[bufferViewId];
    const bufferId = bufferView.buffer;
    const referencedBuffer = buffers[bufferId];

    if (!referencedBuffer) {
      throw new Error(util.format('buffer ID reference not found: %s', bufferId));
    }

    bufferView.buffer = argv.cesium ? 'KHR_binary_glTF' : 'binary_glTF';
    bufferView.byteOffset += referencedBuffer.byteOffset;
  });

  // TODO: embed shaders and images into body (especially if already embedded as base64)
  Object.keys(scene.shaders).forEach(function (bufferViewId) {
    const bufferView = scene.bufferViews[bufferViewId];
    const bufferId = bufferView.buffer;
    const referencedBuffer = buffers[bufferId];

    if (!referencedBuffer) {
      throw new Error(util.format('buffer ID reference not found: %s', bufferId));
    }

    bufferView.buffer = argv.cesium ? 'KHR_binary_glTF' : 'binary_glTF';
    bufferView.byteOffset += referencedBuffer.byteOffset;
  });


  const newSceneStr = JSON.stringify(scene);
  const sceneLength = Buffer.byteLength(newSceneStr);
  // As body is 4-byte aligned, the scene length must be padded to have a multiple of 4.
  // jshint bitwise:false
  const paddedSceneLength = (sceneLength + 3) & ~3;
  // jshint bitwise:true

  // Header is 20 bytes long.
  const bodyOffset = paddedSceneLength + 20;
  const fileLength = bodyOffset + bodyLength;

  // Let's create our GLB file!
  const glbFile = new Buffer(fileLength);

  // Magic number (the ASCII string 'glTF').
  glbFile.writeUInt32BE(0x676C5446, 0);

  // Binary GLTF is little endian.
  // Version of the Binary glTF container format as a uint32 (vesrion 1).
  glbFile.writeUInt32LE(1, 4);

  // Total length of the generated file in bytes (uint32).
  glbFile.writeUInt32LE(fileLength, 8);

  // Total length of the scene in bytes (uint32).
  glbFile.writeUInt32LE(paddedSceneLength, 12);

  // Scene format as a uint32 (JSON is 0).
  glbFile.writeUInt32LE(0, 16);

  // Write the scene.
  glbFile.write(newSceneStr, 20);

  // Add spaces as padding to ensure scene is a multiple of 4 bytes.
  for (let i = sceneLength + 20; i < bodyOffset; ++i) glbFile[i] = 0x20;

  // Write the body.
  const bodyPartPromises = [];
  const containingFolder = path.dirname(filename);

  Object.keys(buffers).forEach(function (bufferId) {
    const bufferInfo = buffers[bufferId];

    return Promise.try(function () {
      const uri = bufferInfo.uri;

      if (uri.startsWith('data:')) {
        const base64Regexp = /^data:.*?;base64,/;
        if (!base64Regexp.test(uri)) throw new Error('unsupported data URI');
        return new Buffer(uri.replace(base64Regexp, ''), 'base64');
      }

      return fs.readFileAsync(path.join(containingFolder, uri));
    }).then(function (buffer) {
      buffer.copy(glbFile, bodyOffset + bufferInfo.byteOffset);
    });
  });

  return Promise.all(bodyPartPromises).then(function () {
    return fs.writeFileAsync(filename.replace(/\.gltf$/, '.glb'), glbFile);
  });
}).error(function (error) {
  console.error('Failed to create binary GLTF file:');
  console.error('----------------------------------');
  console.error(error);
});
