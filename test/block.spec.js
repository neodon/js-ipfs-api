/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const multihash = require('multihashes')
const CID = require('cids')

const expect = chai.expect
chai.use(dirtyChai)
const loadFixture = require('aegir/fixtures')

const IPFSApi = require('../src')
const f = require('./utils/factory')

function fixture(path) {
  return loadFixture(path, 'interface-ipfs-core')
}

describe('.block', function () {
  this.timeout(50 * 1000) // slow CI

  let ipfs
  let ipfsd

  before((done) => {
    f.spawn({ initOptions: { bits: 1024 } }, (err, _ipfsd) => {
      expect(err).to.not.exist()
      ipfsd = _ipfsd
      ipfs = IPFSApi(_ipfsd.apiAddr)
      done()
    })
  })

  after((done) => {
    if (!ipfsd) return done()
    ipfsd.stop(done)
  })

  it('.put', (done) => {
    const blob = fixture('js/test/fixtures/testfile.txt')
    const cidHash = 'Qma4hjFTnCasJ8PVp3mZbZK5g2vGDT4LByLJ7m8ciyRFZP'
    ipfs.block.put(blob, cidHash, (err, block) => {
      expect(err).to.not.exist()
      expect(block.data).to.be.eql(blob)
      expect(multihash.toB58String(block.cid.multihash)).to.eql(cidHash)
      done()
    })
  })
})
