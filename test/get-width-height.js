'use strict';

/* global describe, it */
const getWidthHeight = require('../src/get-width-height.js');
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const expect = chai.expect;

const files = new Map();
for (const type of [ 'png', 'jpeg', 'gif', 'bmp', 'tiff' ]) {
  files.set(type, fs.readFileAsync('test/img1-preview.' + type));
}

function testImage(typeToTest, acceptableTypes, canThrow) {
  acceptableTypes = new Set(acceptableTypes);
  for (const [ type, image ] of files) {
    const shouldPass = acceptableTypes.has(type);

    it(`should ${shouldPass ? '' : 'not '}work with ${type.toUpperCase()} files`, function () {
      return image.then(function (buffer) {
        if (shouldPass) {
          const dimensions = getWidthHeight[typeToTest](buffer);
          expect(dimensions.width).to.equal(480);
          expect(dimensions.height).to.equal(320);
        } else if (canThrow) {
          expect(() => getWidthHeight[typeToTest](buffer)).to.throw();
        } else {
          expect(getWidthHeight[typeToTest](buffer)).to.equal(null);
        }
      });
    });
  }
}

describe('getWidthHeight', function () {
  describe('.png()', function () {
    testImage('png', [ 'png' ]);
  });

  describe('.jpeg()', function () {
    testImage('jpeg', [ 'jpeg' ]);
  });

  describe('.gif()', function () {
    testImage('gif', [ 'gif' ]);
  });

  describe('.bmp()', function () {
    testImage('bmp', [ 'bmp' ]);
  });

  testImage('all', [ 'png', 'jpeg', 'gif', 'bmp' ], true);
});
