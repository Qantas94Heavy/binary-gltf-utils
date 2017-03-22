'use strict';

const BINARY_EXTENSION = 'KHR_binary_glTF';
const BINARY_BUFFER = 'binary_glTF';
const Promise = require('bluebird');
const Body = require('./body.js');
const getWidthHeight = require('./get-width-height.js');

// FIXME: byteLength on bufferviews need to be offset by 4
function moveBuffersToBody(scene, body) {
  // Modify the GLTF data to reference the buffer in the body instead of external references.
  const bufferPromises = [];
  for (const bufferId of Object.keys(scene.buffers)) {
    const gltfBuffer = scene.buffers[bufferId];

    // Technically "text" is meant to be supported, but it was never clear how to implement it, so
    // it is being removed for glTF 2.0. See https://github.com/KhronosGroup/glTF/issues/629
    // and https://github.com/KhronosGroup/glTF/issues/786.
    const type = gltfBuffer.type;
    if (type && type !== 'arraybuffer') {
      throw new Error(`buffer type "${type}" not supported: ${bufferId}`);
    }

    const promise = body.add(gltfBuffer.uri, gltfBuffer.byteLength).then(function (obj) {
      // Set this temporarily for easier manipulation of bufferViews.
      if (!gltfBuffer.extras) gltfBuffer.extras = {};
      gltfBuffer.extras.byteOffset = obj.offset;
    });

    bufferPromises.push(promise);
  }

  return Promise.all(bufferPromises);
}

function convert(scene, containingFolder, embed) {
  const body = new Body(containingFolder);

  // Let a GLTF parser know that it is using the Binary GLTF extension.
  if (Array.isArray(scene.extensionsUsed)) scene.extensionsUsed.push(BINARY_EXTENSION);
  else scene.extensionsUsed = [ BINARY_EXTENSION ];

  // Wait for this to be done so that the buffer view code can read from existing buffers.
  return moveBuffersToBody(scene, body).then(function () {
    // Modify buffer views to point to the binary GLTF buffer instead of another one.
    for (const bufferViewId of Object.keys(scene.bufferViews)) {
      const bufferView = scene.bufferViews[bufferViewId];
      const bufferId = bufferView.buffer;

      // Try to find buffer in scene description using its ID.
      const referencedBuffer = scene.buffers[bufferId];
      if (!referencedBuffer) throw new Error(`buffer ID reference not found: ${bufferId}`);

      // Reassign this buffer view to the binary GLTF buffer.
      bufferView.buffer = BINARY_BUFFER;
      bufferView.byteOffset += referencedBuffer.extras.byteOffset;
    }

    // Store list of asynchronous items (e.g. opening files) to be completed.
    const promises = [];

    // Merge shader binaries into the main Binary GLTF file.
    // TODO: materials spec???
    if (embed.shaders && scene.shaders) {
      for (const shaderId of Object.keys(scene.shaders)) {
        const shader = scene.shaders[shaderId];
        const uri = shader.uri;

        // We'll assume absolute URLs shouldn't be inlined.
        if (uri.startsWith('http://') || uri.startsWith('https://')) continue;

        // The "uri" property is ignored by Binary GLTF readers, but technically needs to be there
        // as extensions to GLTF can't remove existing required properties.
        shader.uri = '';

        const promise = body.add(uri).then(function (obj) {
          const bufferViewId = 'binary_glTF_shader_' + shaderId;

          if (!shader.extensions) shader.extensions = {};
          shader.extensions[BINARY_EXTENSION] = { bufferView: bufferViewId };

          scene.bufferViews[bufferViewId] =
            { buffer: BINARY_BUFFER
            , byteLength: obj.buffer.length
            , byteOffset: obj.offset
            };
        });

        promises.push(promise);
      }
    }

    // TODO: embed images into body (especially if already embedded as base64)
    if (embed.textures && scene.images) {
      for (const imageId of Object.keys(scene.images)) {
        const image = scene.images[imageId];
        const uri = image.uri;

        // We'll assume absolute URLs shouldn't be inlined.
        if (uri.startsWith('http://') || uri.startsWith('https://')) continue;

        // The "uri" property is ignored by Binary GLTF readers, but technically needs to be there
        // as extensions to GLTF can't remove existing required properties.
        image.uri = '';

        const addingImage = body.add(uri).then(function (obj) {
          const bufferViewId = 'binary_glTF_images_' + imageId;

          // Get the properties of the image to add as metadata.
          const widthHeight = getWidthHeight(obj.buffer);

          if (!image.extensions) image.extensions = {};
          image.extensions[BINARY_EXTENSION] =
            { bufferView: bufferViewId
            , mimeType: widthHeight.mimeType
            , height: widthHeight.height
            , width: widthHeight.width
            };

          scene.bufferViews[bufferViewId] =
            { buffer: BINARY_BUFFER
            , byteLength: obj.buffer.length
            , byteOffset: obj.offset
            };
        });

        promises.push(addingImage);
      }
    }

    return Promise.all(promises);
  }).then(function () {
    // All buffer views now reference the "binary_glTF" buffer, so the original buffer objects are
    // no longer needed.
    scene.buffers = {};
    return body.createGlb(scene);
  });
}

module.exports = convert;
