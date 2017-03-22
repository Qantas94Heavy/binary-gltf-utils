#!/usr/bin/env node
'use strict';

const Promise = require('bluebird');
const path = require('path');
const fs = Promise.promisifyAll(require('fs'));
const convert = require('./convert.js');

const embedArr = [ 'textures', 'shaders' ];
const embed = new Set;

const argv = require('yargs')
  .usage('Usage: $0 <file> [options]')
  .demand(1)
  .array('e')
  .describe('e', 'le')
  .choices('e', embedArr)
  .alias('e', 'embed')
  .skipValidation('e')
  .boolean('cesium')
  .describe('cesium', 'OBSOLETE (has no effect, no longer required by Cesium)')
  .help('h')
  .alias('h', 'help')
  .argv;

if (argv.embed) {
  // FIXME: throw error if type is wrong.
  // If just specified as --embed, embed all types into body.
  const arr = argv.embed.length ? argv.embed : embedArr;

  // Enable the specific type of resource to be embedded.
  for (const type of arr) embed[type] = true;
}

if (argv.cesium) {
  console.warn('[binary-gltf-utils] The --cesium flag is deprecated and has no effect.');
  console.warn('It will be removed in a future release.');
}

const filename = argv._[0];
const containingFolder = path.dirname(filename);

if (filename.endsWith('.gltf')) {
  fs.readFileAsync(filename, 'utf-8').then(
    gltf => convert(JSON.parse(gltf), containingFolder, embed)
  ).then(
    glbFile => fs.writeFileAsync(filename.slice(0, -5) + '.glb', glbFile)
  ).error(function (error) {
    console.error('Failed to create binary GLTF file:');
    console.error('----------------------------------');
    console.error(error);
    process.exitCode = 1;
  });
} else {
  console.error('Failed to create binary GLTF file:');
  console.error('----------------------------------');
  console.error('File specified does not have the .gltf extension.');
  process.exitCode = 1;
}
