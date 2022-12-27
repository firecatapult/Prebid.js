import {expect} from 'chai';
import {spec} from 'modules/catapultxBidAdapter';
import * as utils from 'src/utils';
import {BANNER} from 'src/mediaTypes';
import {config} from 'src/config';

describe('CatapultX adapter', () => {
  const sample_qxData = {
      groupId: 'internal',
      testKey: 'Key_1'
    },
    no_params_bid = {
      bidder: 'catapultx',
      bidId: 'testBid1',
      bidderRequestId: 'testRequest1',
      auctionId: 'eb66abdc-bdb4-4dfd-a5af-9a9ec70dc98a'
    },
    no_groupId_bid = {
      bidder: 'catapultx',
      params: {},
      adUnitCode: 'adUnitTestCode',
      bidId: 'testBid1',
      bidderRequestId: 'testRequest1',
      auctionId: 'eb66abdc-bdb4-4dfd-a5af-9a9ec70dc98a',
      mediaTypes: {
        banner: {
          sizes: [[300, 250]]
        }
      }
    },
    empty_groupId_bid = {
      bidder: 'catapultx',
      params: {groupId: ''},
      adUnitCode: 'adUnitTestCode',
      bidId: 'testBid1',
      bidderRequestId: 'testRequest1',
      auctionId: 'eb66abdc-bdb4-4dfd-a5af-9a9ec70dc98a',
      mediaTypes: {
        banner: {
          sizes: [[300, 250]]
        }
      }
    },
    native_bid = {
      bidder: 'catapultx',
      params: {groupId: 'internal'},
      adUnitCode: 'adUnitTestCode',
      bidId: 'testBid1',
      bidderRequestId: 'testRequest1',
      auctionId: 'eb66abdc-bdb4-4dfd-a5af-9a9ec70dc98a',
      mediaTypes: {
        native: {}
      }
    },
    no_optional_params_valid_bid = {
      bidder: 'catapultx',
      params: {groupId: 'internal'},
      adUnitCode: 'adUnitTestCode',
      bidId: 'testBid1',
      bidderRequestId: 'testRequest1',
      auctionId: 'eb66abdc-bdb4-4dfd-a5af-9a9ec70dc98a',
      mediaTypes: {
        banner: {
          sizes: [[300, 250]]
        }
      }
    },
    no_qxdata_has_apiurl_bid = {
      bidder: 'catapultx',
      params: {groupId: 'internal', apiUrl: 'example.com'},
      adUnitCode: 'adUnitTestCode',
      bidId: 'testBid1',
      bidderRequestId: 'testRequest1',
      auctionId: 'eb66abdc-bdb4-4dfd-a5af-9a9ec70dc98a',
      mediaTypes: {
        banner: {
          sizes: [[300, 250]]
        }
      }
    },
    no_apiUrl_has_qxData_bid = {
      bidder: 'catapultx',
      params: {groupId: 'internal', qxData: {}},
      adUnitCode: 'adUnitTestCode',
      bidId: 'testBid2',
      bidderRequestId: 'testRequest1',
      auctionId: 'eb66abdc-bdb4-4dfd-a5af-9a9ec70dc98a',
      mediaTypes: {
        banner: {
          sizes: [[300, 250]]
        }
      }
    },
    non_enriched_bid_multiple_sizes = {
      bidder: 'catapultx',
      params: {groupId: 'internal'},
      adUnitCode: 'adUnitTestCode',
      bidId: 'testBid2',
      bidderRequestId: 'testRequest1',
      auctionId: 'eb66abdc-bdb4-4dfd-a5af-9a9ec70dc98a',
      mediaTypes: {
        banner: {
          sizes: [[300, 250], [900, 78]]
        }
      }
    },
    enriched_overlay_request = {
      bidder: 'catapultx',
      params: {groupId: 'internal', qxData: sample_qxData, apiUrl: 'example.com'},
      adUnitCode: 'adUnitTestCode',
      bidId: 'testBid3',
      bidderRequestId: 'testRequest1',
      ortb2Imp: {
        ext: {
          data: {
            arr: [1, 2, 3],
            str: 'test',
            int: 123,
            obj: {test: 'test'}
          }
        }
      },
      auctionId: 'eb66abdc-bdb4-4dfd-a5af-9a9ec70dc98a',
      mediaTypes: {
        banner: {
          sizes: [[300, 250]]
        }
      }
    },
    no_seatbid_response = {
      'id': '26afda50-b43b-49c5-8b27-a25149167283',
      'seatbid': [],
      'bidid': 'bidid',
      'cur': 'USD',
      'nbr': 0
    },
    missing_seatbid_response = {
      'id': '26afda50-b43b-49c5-8b27-a25149167283',
      'bidid': 'bidid',
      'cur': 'USD',
      'nbr': 0
    },
    missing_cur_bid_response = {
      'id': '26afda50-b43b-49c5-8b27-a25149167283',
      'seatbid': [
        {
          'bid': [
            {
              'id': 'id123',
              'impid': 'testBid3',
              'price': 2,
              'adid': '80152',
              'nurl': 'https://demand.example.com/win?i=id123',
              'adm': '<!-- cx bidadapter test -->',
              'adomain': [
                'example.com'
              ],
              'iurl': 'https://demand.example.com/yetfs.png',
              'cid': '1234',
              'crid': 'crid123',
              'cat': [
                'IAB1',
                'IAB2',
                'IAB123'
              ],
              'w': 728,
              'h': 90
            }
          ],
          'seat': '123555'
        }
      ],
      'bidid': 'bidid',
      'nbr': 0
    },
    bid_response = {
      'id': '26afda50-b43b-49c5-8b27-a25149167283',
      'seatbid': [
        {
          'bid': [
            {
              'id': 'id123',
              'impid': 'testBid3',
              'price': 2,
              'adid': '80152',
              'nurl': 'https://demand.example.com/win?i=id123',
              'adm': '<!-- cx bidadapter test -->',
              'adomain': [
                'example.com'
              ],
              'iurl': 'https://demand.example.com/yetfs.png',
              'cid': '1234',
              'crid': 'crid123',
              'cat': [
                'IAB1',
                'IAB2',
                'IAB123'
              ],
              'w': 728,
              'h': 90
            }
          ],
          'seat': '123555'
        }
      ],
      'bidid': 'bidid',
      'cur': 'testCur',
      'nbr': 0
    }

  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
    config.resetConfig();
  });

  function buildBidderRequest(url = 'https://example.com/index.html', params = {}) {
    return Object.assign({}, params, {refererInfo: {page: url, reachedTop: true}, timeout: 3000, bidderCode: 'catapultx'});
  }
  const DEFAULT_BIDDER_REQUEST = buildBidderRequest();

  function buildRequest(bidRequests, bidderRequest = DEFAULT_BIDDER_REQUEST, dnt = true) {
    let dntmock = sandbox.stub(utils, 'getDNT').callsFake(() => dnt);
    bidderRequest.bids = bidRequests;
    let requests = spec.buildRequests(bidRequests, bidderRequest);
    dntmock.restore();
    return requests
  }

  describe('bid request validation', () => {
    it('fails validation for bid with no params object', () => {
      expect(spec.isBidRequestValid(no_params_bid)).to.be.equal(false);
    });

    it('fails validation for bid with no groupId', () => {
      expect(spec.isBidRequestValid(no_groupId_bid)).to.be.equal(false);
    });

    it('fails validation for bid wth empty groupId', () => {
      expect(spec.isBidRequestValid(empty_groupId_bid)).to.be.equal(false);
    });

    it('will not validate non banner bids', () => {
      expect(spec.isBidRequestValid(native_bid)).to.be.equal(false);
    });

    it('will validate complete banner requests with no optional parameters', () => {
      expect(spec.isBidRequestValid(no_optional_params_valid_bid)).to.be.equal(true);
    });

    it('will validate requests that use optional parameters', () => {
      expect(spec.isBidRequestValid(no_qxdata_has_apiurl_bid)).to.be.equal(true);
      expect(spec.isBidRequestValid(no_apiUrl_has_qxData_bid)).to.be.equal(true);
      expect(spec.isBidRequestValid(enriched_overlay_request)).to.be.equal(true);
    })
  });

  describe('interpreting group id and apiUrl', () => {
    it('should default to default apiUrl', () => {
      let requests = buildRequest([no_apiUrl_has_qxData_bid]);
      expect(requests[0].url).to.have.string('https://demand.catapultx.com');
    });

    it('should set apiUrl if sent in params', () => {
      let requests = buildRequest([enriched_overlay_request]);
      expect(requests[0].url).to.have.string('example.com');
      expect(requests[0].url.split('/')[0]).to.be.eql('example.com');
    });

    it('should set groupId from params', () => {
      let requests = buildRequest([enriched_overlay_request]);
      expect(requests[0].url).to.have.string('internal');
      expect(requests[0].url.split('/').pop()).to.be.eql('internal');
    });
  });

  describe('ortb imp generation', () => {
    let ortbImps;

    before(() => {
      let requests = buildRequest([no_qxdata_has_apiurl_bid, enriched_overlay_request]);
      ortbImps = requests[0].data.imp;
    });

    it('should have banner object', () => {
      expect(ortbImps[0]).to.have.property('banner');
    });

    it('should have corresponding bidId', () => {
      expect(ortbImps[0]).to.have.property('id');
      expect(ortbImps[0].id).to.be.eql('testBid1');
      expect(ortbImps[1]).to.have.property('id');
      expect(ortbImps[1].id).to.be.eql('testBid3');
    });

    it('should have format object', () => {
      expect(ortbImps[0].banner).to.have.property('format');
      expect(ortbImps[0].banner.format).to.be.eql([{w: 300, h: 250}]);
    });

    it('should evaluate and send secure value', () => {
      expect(ortbImps[0]).to.have.property('secure', 1);
    });

    it('should properly identify non https and send 0 for secure', () => {
      let httpRequests = buildRequest([enriched_overlay_request], buildBidderRequest('http://example.com/index.html'));
      let notSecure = httpRequests[0].data.imp[0];
      expect(notSecure).to.have.property('secure', 0);
    });

    it('should have tagid', () => {
      expect(ortbImps[0]).to.have.property('tagid', 'adUnitTestCode');
    });

    it('should default bidfloor 0 if not configured', function() {
      expect(ortbImps[0]).to.have.property('bidfloor', 0);
    });

    it('should set bidfloor if configured', function() {
      let bid = Object.assign({}, enriched_overlay_request);
      bid.getFloor = function() {
        return {
          currency: 'USD',
          floor: 0.145
        }
      };
      let requests = buildRequest([bid]);
      expect(requests[0].data.imp[0]).to.have.property('bidfloor', 0.145);
    });

    it('should set bidfloor if configured on bid with multiple sizes', function() {
      let bid = Object.assign({}, non_enriched_bid_multiple_sizes);
      bid.getFloor = function() {
        return {
          currency: 'USD',
          floor: 0.145
        }
      };
      let requests = buildRequest([bid]);
      expect(requests[0].data.imp[0]).to.have.property('bidfloor', 0.145);
    });

    it('should not add ext object with no ortb2imp injection', () => {
      expect(ortbImps[0]).to.not.have.property('ext');
    });

    it('should map object from ortb2imp injection', () => {
      expect(ortbImps[1]).to.have.property('ext');
      expect(ortbImps[1].ext).to.be.eql(enriched_overlay_request.ortb2Imp.ext);
    });
  });

  describe('monetize request generation', () => {
    let monetizeRequest;

    before(() => {
      let requests = buildRequest([no_qxdata_has_apiurl_bid, enriched_overlay_request]);
      monetizeRequest = requests[0].data;
    });

    it('should have tmax', () => {
      expect(monetizeRequest.tmax).to.be.equal(3000);
    });

    it('will not add qxData object if it does not exist', () => {
      expect(monetizeRequest).to.not.have.property('qxData');
    });

    it('will send qxData object when applicable', () => {
      let overlay_mock = buildRequest([enriched_overlay_request]);
      const enrichedRequest = overlay_mock[0].data;
      expect(enrichedRequest.qxData).to.be.eql(sample_qxData);
    });

    it('will not add consent information if it does not exist', () => {
      expect(monetizeRequest).to.not.have.property('GDPRApplies');
      expect(monetizeRequest).to.not.have.property('TCString');
      expect(monetizeRequest).to.not.have.property('USPString');
    });

    it('should contain gdpr-related information if consent is configured', () => {
      let requests = buildRequest([enriched_overlay_request],
        buildBidderRequest('https://example.com/index.html',
          {gdprConsent: {gdprApplies: true, consentString: 'tcStringValue', vendorData: {}}, uspConsent: '1YNN'}));
      monetizeRequest = requests[0].data;
      expect(monetizeRequest).to.have.property('GDPRApplies');
      expect(monetizeRequest.GDPRApplies).to.be.eql(1);
      expect(monetizeRequest).to.have.property('TCString');
      expect(monetizeRequest.TCString).to.be.eql('tcStringValue');
      expect(monetizeRequest).to.have.property('USPString');
      expect(monetizeRequest.USPString).to.be.eql('1YNN');
    });

    it('should send 0 value for coppa when not true', () => {
      expect(monetizeRequest.coppa).to.be.eql(0);
    });

    it('should contain coppa if configured', () => {
      config.setConfig({coppa: true});
      let requests = buildRequest([no_qxdata_has_apiurl_bid]);
      monetizeRequest = requests[0].data;
      expect(monetizeRequest).to.have.property('coppa');
      expect(monetizeRequest.coppa).to.be.eql(1);
    });

    it('should only send configured values for consent information', () => {
      let requests = buildRequest([enriched_overlay_request], buildBidderRequest('https://example.com/index.html', {gdprConsent: {gdprApplies: false}}));
      monetizeRequest = requests[0].data;
      expect(monetizeRequest).to.have.property('GDPRApplies')
      expect(monetizeRequest.GDPRApplies).to.be.eql(0);
      expect(monetizeRequest).to.not.have.property('TCString');
      expect(monetizeRequest).to.not.have.property('USPString');
    });

    it('should not include dnt if not applicable', () => {
      let requests = buildRequest([enriched_overlay_request], DEFAULT_BIDDER_REQUEST, false);
      expect(requests[0].data).to.not.have.property('dnt');
    });

    it('should set dnt if applicable', () => {
      expect(monetizeRequest).to.have.property('dnt');
      expect(monetizeRequest.dnt).to.be.eql(1);
    });
  });

  describe('interprets responses', () => {
    it('should return empty array for no bid response in seatbid', () => {
      let resp = spec.interpretResponse({body: no_seatbid_response});
      expect(resp).to.be.eql([]);
    });

    it('should return empty array for missing seatbid array', () => {
      let resp = spec.interpretResponse({body: missing_seatbid_response});
      expect(resp).to.be.eql([]);
    });

    it('should default currency to USD when cur is missing from response', () => {
      let resp = spec.interpretResponse({body: missing_cur_bid_response})[0];
      expect(resp).to.have.property('currency');
      expect(resp.currency).to.be.eql('USD');
    });

    it('should interpret banner rtb response', () => {
      let resp = spec.interpretResponse({body: bid_response})[0];
      expect(resp).to.have.property('requestId', 'testBid3');
      expect(resp).to.have.property('cpm', 2);
      expect(resp).to.have.property('width', 728);
      expect(resp).to.have.property('height', 90);
      expect(resp).to.have.property('creativeId', 'crid123');
      expect(resp).to.have.property('currency');
      expect(resp.currency).to.be.eql('testCur');
      expect(resp).to.have.property('ttl');
      expect(resp).to.have.property('mediaType', BANNER);
      expect(resp).to.have.property('ad');
      expect(resp.ad).to.have.string('<!-- cx bidadapter test -->');
      expect(resp).to.have.property('meta');
      expect(resp).to.have.property('netRevenue');
      expect(resp.netRevenue).to.be.true;
      expect(resp.meta.advertiserDomains).to.be.eql(['example.com']);
      expect(resp.meta.primaryCatId).to.be.eql('IAB1');
      expect(resp.meta.secondaryCatIds).to.be.eql(['IAB2', 'IAB123']);
    });
  });
});
