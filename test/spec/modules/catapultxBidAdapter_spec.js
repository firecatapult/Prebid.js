import {expect} from 'chai';
import {spec} from 'modules/qortexBidAdapter';
import * as utils from 'src/utils';
import {BANNER} from 'src/mediaTypes';
import {config} from 'src/config';

describe('qortex adapter', () => {
  let bidRequest;
  let bidResponse;

  const sample_qxData = {
      groupId: 'internal',
      testKey: 'Key_1'
    }

  const ortb2Data = {
      site: {
        content: {
          id: '123456',
          episode: 15,
          title: 'test episode',
          series: 'test show',
          season: '1',
          url: 'https://example.com/file.mp4'
        }
      }
    }

  const exampleUrl = 'https://example.com/index.html';

  beforeEach(() => {
    bidRequest = {
      bidder: 'qortex',
      params: {groupId: 'internal', qxData: sample_qxData, apiUrl: 'https://example.com'},
      adUnitCode: 'adUnitTestCode',
      bidId: 'bidRequestId',
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
    };
    bidResponse = {
      id: '26afda50-b43b-49c5-8b27-a25149167283',
      seatbid: [
        {
          bid: [
            {
              id: 'id123',
              impid: 'testBid3',
              price: 2,
              adid: '80152',
              nurl: 'https://demand.example.com/win?i=id123',
              adm: '<!-- cx bidadapter test -->',
              adomain: [
                'example.com'
              ],
              iurl: 'https://demand.example.com/yetfs.png',
              cid: '1234',
              crid: 'crid123',
              cat: [
                'IAB1',
                'IAB2',
                'IAB123'
              ],
              w: 728,
              h: 90
            }
          ],
          seat: '123555'
        }
      ],
      bidid: 'bidid',
      cur: 'testCur',
      nbr: 0
    }
  });

  afterEach(() => {
    config.resetConfig();
  });

  const buildBidderRequest = (url = exampleUrl, params = {}) => {
    return Object.assign({}, params, {refererInfo: {page: url, reachedTop: true}, timeout: 3000, bidderCode: 'qortex'});
  }

  const buildRequest = (bidRequests, bidderRequest = buildBidderRequest(), dnt = true) => {
    let dntmock = sinon.stub(utils, 'getDNT').callsFake(() => dnt);
    bidderRequest.bids = bidRequests;
    let request = spec.buildRequests(bidRequests, bidderRequest);
    dntmock.restore();
    return request;
  }

  const data = (request) => {
    return JSON.parse(request.data);
  }

  describe('bid request validation', () => {
    it('fails validation for bid with no params object', () => {
      delete bidRequest.params;
      expect(spec.isBidRequestValid(bidRequest)).to.be.equal(false);
    });

    it('fails validation for bid with no groupId', () => {
      delete bidRequest.params.groupId;
      expect(spec.isBidRequestValid(bidRequest)).to.be.equal(false);
    });

    it('fails validation for bid wth empty groupId', () => {
      bidRequest.params.groupId = '';
      expect(spec.isBidRequestValid(bidRequest)).to.be.equal(false);
    });

    it('will not validate non banner bids', () => {
      bidRequest.mediaTypes = { native: {} };
      expect(spec.isBidRequestValid(bidRequest)).to.be.equal(false);
    });

    it('will validate complete banner requests with no optional parameters', () => {
      delete bidRequest.params.apiUrl;
      delete bidRequest.params.qxData;
      expect(spec.isBidRequestValid(bidRequest)).to.be.equal(true);
    });
  });

  describe('interpreting group id and apiUrl', () => {
    const endpointPath = '/api/v1/monetize/resources/prebid'
    const defaultApiHost = 'https://demand.qortex.ai';

    it('should default to default apiUrl', () => {
      delete bidRequest.params.apiUrl;
      let request = buildRequest([bidRequest]);
      expect(request.url).to.be.eql(defaultApiHost + endpointPath);
    });

    it('should set apiUrl if sent in params', () => {
      let request = buildRequest([bidRequest]);
      expect(request.url).to.be.eql(bidRequest.params.apiUrl + endpointPath);
    });

    it('should set groupId from params', () => {
      let request = buildRequest([bidRequest]);
      expect(data(request).groupId).to.be.eql(bidRequest.params.groupId);
    });
  });

  describe('ortb imp generation', () => {
    let ortbImp;

    beforeEach(() => {
      ortbImp = data(buildRequest([bidRequest])).imp[0];
    });

    it('should have banner object', () => {
      expect(ortbImp).to.have.property('banner');
    });

    it('should create multiple imps for multiple bids', () => {
      const bidRequest2 = Object.assign({}, bidRequest);
      bidRequest2.bidId = 'bidRequest2Id'
      const imps = data(buildRequest([bidRequest, bidRequest2])).imp;
      expect(imps.length).to.eql(2);
      expect(imps[0]).to.have.property('id');
      expect(imps[0].id).to.eql('bidRequestId');
      expect(imps[1]).to.have.property('id');
      expect(imps[1].id).to.eql('bidRequest2Id');
    });

    it('should have format object', () => {
      expect(ortbImp.banner).to.have.property('format');
      expect(ortbImp.banner.format).to.be.eql([{w: 300, h: 250}]);
    });

    it('should evaluate and send secure value', () => {
      expect(ortbImp).to.have.property('secure', 1);
    });

    it('should properly identify non https and send 0 for secure', () => {
      const nonSecureUrl = 'http://example.com/index.html';
      const request = buildRequest([bidRequest], buildBidderRequest(nonSecureUrl));
      const notSecureImp = data(request).imp[0];
      expect(notSecureImp).to.have.property('secure', 0);
    });

    it('should have tagid', () => {
      expect(ortbImp).to.have.property('tagid', 'adUnitTestCode');
    });

    it('should default bidfloor 0 if not configured', () => {
      expect(ortbImp).to.have.property('bidfloor', 0);
    });

    it('should default bidfloor 0 if getFloor returns invalid response', () => {
      bidRequest.getFloor = () => {
        return "string";
      };
      const imp = data(buildRequest([bidRequest])).imp[0];
      expect(imp).to.have.property('bidfloor', 0);
    });

    it('should set bidfloor if configured', () => {
      bidRequest.getFloor = () => {
        return {
          currency: 'USD',
          floor: 0.145
        }
      };
      const imp = data(buildRequest([bidRequest])).imp[0];
      expect(imp).to.have.property('bidfloor', 0.145);
    });

    it('should set bidfloor if configured on bid with multiple sizes', () => {
      bidRequest.mediaTypes.banner.sizes = [[300, 250], [900, 78]]
      bidRequest.getFloor = () => {
        return {
          currency: 'USD',
          floor: 0.145
        }
      };
      const imp = data(buildRequest([bidRequest])).imp[0];
      expect(imp).to.have.property('bidfloor', 0.145);
    });

    it('should map object from ortb2imp injection', () => {
      expect(ortbImp).to.have.property('ext');
      expect(ortbImp.ext).to.be.eql(bidRequest.ortb2Imp.ext);
    });

    it('should not add ext object with no ortb2imp available', () => {
      delete bidRequest.ortb2Imp;
      ortbImp = data(buildRequest([bidRequest])).imp[0];
      expect(ortbImp).to.not.have.property('ext');
    });
  });

  describe('monetize request generation', () => {
    let monetizeRequest;

    beforeEach(() => {
      monetizeRequest = data(buildRequest([bidRequest]));
    });

    it('should have tmax', () => {
      expect(monetizeRequest.tmax).to.be.equal(3000);
    });

    it('will not add qxData object if it does not exist', () => {
      delete bidRequest.params.qxData;
      monetizeRequest = data(buildRequest([bidRequest]));
      expect(monetizeRequest).to.not.have.property('qxData');
    });

    it('will send qxData object when applicable', () => {
      monetizeRequest = data(buildRequest([bidRequest]));
      expect(monetizeRequest.qxData).to.be.eql(sample_qxData);
    });

    it('will not add consent information if it does not exist', () => {
      expect(monetizeRequest).to.not.have.property('GDPRApplies');
      expect(monetizeRequest).to.not.have.property('TCString');
      expect(monetizeRequest).to.not.have.property('USPString');
    });

    it('will not add gdprApplies if unavailable', () => {
      const request = buildRequest([bidRequest],
        buildBidderRequest(exampleUrl,
          {gdprConsent: {}, uspConsent: '1YNN'}));
      monetizeRequest = data(request);
      expect(monetizeRequest).to.not.have.property('GDPRApplies');
    })

    it('should contain gdpr-related information if consent is configured', () => {
      const request = buildRequest([bidRequest],
        buildBidderRequest(exampleUrl,
          {gdprConsent: {gdprApplies: true, consentString: 'tcStringValue', vendorData: {}}, uspConsent: '1YNN'}));
      monetizeRequest = data(request);
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
      const request = buildRequest([bidRequest]);
      monetizeRequest = data(request);
      expect(monetizeRequest).to.have.property('coppa');
      expect(monetizeRequest.coppa).to.be.eql(1);
    });

    it('should only send configured values for consent information', () => {
      const request = buildRequest([bidRequest], buildBidderRequest(exampleUrl, {gdprConsent: {gdprApplies: false}}));
      monetizeRequest = data(request);
      expect(monetizeRequest).to.have.property('GDPRApplies')
      expect(monetizeRequest.GDPRApplies).to.be.eql(0);
      expect(monetizeRequest).to.not.have.property('TCString');
      expect(monetizeRequest).to.not.have.property('USPString');
    });

    it('should include site.content if available', () => {
      const request = buildRequest([bidRequest], buildBidderRequest(exampleUrl, { ortb2: ortb2Data }));
      monetizeRequest = data(request);
      expect(monetizeRequest.content).to.be.eql(ortb2Data.site.content);
    })

    it('should not include site.content if not available', () => {
      expect(monetizeRequest).to.not.have.property('content');
    })

    it('should not include dnt if not applicable', () => {
      const request = buildRequest([bidRequest], buildBidderRequest(), false);
      expect(data(request)).to.not.have.property('dnt');
    });

    it('should set dnt if applicable', () => {
      expect(monetizeRequest).to.have.property('dnt');
      expect(monetizeRequest.dnt).to.be.eql(1);
    });
  });

  describe('interprets responses', () => {
    it('should return empty array for no bid response in seatbid', () => {
      bidResponse.seatbid = []
      const resp = spec.interpretResponse({body: bidResponse});
      expect(resp).to.be.eql([]);
    });

    it('should return empty array for missing seatbid array', () => {
      delete bidResponse.seatbid 
      const resp = spec.interpretResponse({body: bidResponse});
      expect(resp).to.be.eql([]);
    });

    it('should default currency to USD when cur is missing from response', () => {
      delete bidResponse.cur;
      const resp = spec.interpretResponse({body: bidResponse})[0];
      expect(resp).to.have.property('currency');
      expect(resp.currency).to.be.eql('USD');
    });

    it('should not add invalid adomain', () => {
      bidResponse.seatbid[0].bid[0].adomain = "string"
      const resp = spec.interpretResponse({body: bidResponse})[0];
      expect(resp?.meta?.advertiserDomains).to.be.undefined;
    });

    it('should not add empty cat array', () => {
      bidResponse.seatbid[0].bid[0].cat = []
      const resp = spec.interpretResponse({body: bidResponse})[0];
      expect(resp?.meta?.primaryCatId).to.be.undefined;
    });

    it('should not add secondary category if array only contains one', () => {
      bidResponse.seatbid[0].bid[0].cat = ['IAB1'];
      const resp = spec.interpretResponse({body: bidResponse})[0];
      expect(resp?.meta?.secondaryCatIds).to.be.undefined;
    })

    it('should interpret banner rtb response', () => {
      const resp = spec.interpretResponse({body: bidResponse})[0];
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
