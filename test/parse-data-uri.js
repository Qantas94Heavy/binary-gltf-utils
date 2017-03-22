'use strict';

/* global describe, it */
const parseDataUri = require('../src/parse-data-uri.js');

const chai = require('chai');
const expect = chai.expect;

describe('parseDataUri', function () {
  // jshint expr:true
  it('should record down correct MIME type', function () {
    const obj = parseDataUri('data:text/html;base64,PGh0bWw+');
    expect(obj.mimeType).to.equal('text/html');
  });

  it('should work with non-padded base64 data URIs', function () {
    const obj = parseDataUri('data:text/plain;base64,SSBsb3ZlIHlvdSE');
    const buf = obj.buffer;
    expect(Buffer.isBuffer(buf)).to.be.true;
    expect(buf.toString()).to.equal('I love you!');
  });

  it('should work with padded base64 data URIs', function () {
    const obj = parseDataUri('data:text/plain;base64,SSBsb3ZlIHlvdSE=');
    const buf = obj.buffer;
    expect(Buffer.isBuffer(buf)).to.be.true;
    expect(buf.toString()).to.equal('I love you!');
  });

  it('should work with plain data URIs', function () {
    const obj = parseDataUri('data:text/plain,I love you!');
    const buf = obj.buffer;
    expect(Buffer.isBuffer(buf)).to.be.true;
    expect(buf.toString()).to.equal('I love you!');
  });

  it('should set default MIME type', function () {
    const obj = parseDataUri('data:,I love you!');
    expect(obj.mimeType).to.equal('text/plain;charset=US-ASCII');

    const buf = obj.buffer;
    expect(Buffer.isBuffer(buf)).to.be.true;
    expect(buf.toString()).to.equal('I love you!');
  });

  it('should allow implicit text/plain with charset', function () {
    const obj = parseDataUri('data:;charset=utf-8,I love you!');
    expect(obj.mimeType).to.equal('text/plain;charset=utf-8');

    const buf = obj.buffer;
    expect(Buffer.isBuffer(buf)).to.be.true;
    expect(buf.toString()).to.equal('I love you!');
  });
});
