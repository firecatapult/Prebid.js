import * as utils from 'src/utils';
import * as ajax from 'src/ajax.js';
import * as events from 'src/events.js';
import CONSTANTS from '../../../src/constants.json';
import {loadExternalScript} from 'src/adloader.js';
import {
  qortexSubmodule as module,
  getContext,
  addContextToRequests,
  setContextData,
  initializeModuleData,
  loadScriptTag
} from '../../../modules/qortexRtdProvider';
import { cloneDeep } from 'lodash';

describe('qortexRtdProvider', () => {
  let logWarnSpy;
  let mockServer;
  let ajaxSpy;
  let ortb2Stub;

  const defaultApiHost = 'https://demand.qortex.ai';
  const defaultGroupId = 'test';
  const validBidderArray = ['qortex', 'test'];
  const validTagConfig = {
    videoContainer: 'my-video-container'
  }

  const validModuleConfig = {
    params: {
      groupId: defaultGroupId,
      apiUrl: defaultApiHost,
      bidders: validBidderArray
    }
  };

  const validImpressionEvent = {
      detail: {
        uid: 'uid123',
        type: 'qx-impression'
      }
    },
    validImpressionEvent2 = {
      detail: {
        uid: 'uid1234',
        type: 'qx-impression'
      }
    },
    missingIdImpressionEvent = {
      detail: {
        type: 'qx-impression'
      }
    },
    invalidTypeQortexEvent = {
      detail: {
        type: 'invalid-type'
      }
    }

  const emptyModuleConfig = {
    params: {}
  }

  const responseHeaders = {
    'content-type': 'application/json',
    'access-control-allow-origin': '*'
  };

  const responseObj = {
    content: {
      id: '123456',
      episode: 15,
      title: 'test episode',
      series: 'test show',
      season: '1',
      url: 'https://example.com/file.mp4'
    }
  };

  const apiResponse = JSON.stringify(responseObj);

  const reqBidsConfig = {
    adUnits: [{
      bids: [
        { bidder: 'qortex' }
      ]
    }],
    ortb2Fragments: {
      bidder: {},
      global: {}
    }
  }

  beforeEach(() => {
    mockServer = sinon.createFakeServer();
    mockServer.respondWith([200, responseHeaders, apiResponse]);
    mockServer.respondImmediately = true;
    mockServer.autoRespond = true;

    ortb2Stub = sinon.stub(reqBidsConfig, 'ortb2Fragments').value({bidder: {}, global: {}})
    logWarnSpy = sinon.spy(utils, 'logWarn');
    ajaxSpy = sinon.spy(ajax, 'ajax');
  })

  afterEach(() => {
    ajaxSpy.restore();
    logWarnSpy.restore();
    ortb2Stub.restore();
    mockServer.restore();
    setContextData(null);
  })

  describe('init', () => {
    it('returns true for valid config object', () => {
      expect(module.init(validModuleConfig)).to.be.true;
    })

    it('returns false and logs error for missing groupId', () => {
      expect(module.init(emptyModuleConfig)).to.be.false;
      expect(logWarnSpy.calledOnce).to.be.true;
      expect(logWarnSpy.calledWith('Qortex RTD module config does not contain valid groupId parameter. Config params: {}')).to.be.ok;
    })

    it('loads Qortex script if tagConfig is present in module config params', () => {
      const config = cloneDeep(validModuleConfig);
      config.params.tagConfig = validTagConfig;
      expect(module.init(config)).to.be.true;
      expect(loadExternalScript.calledOnce).to.be.true;
    })
  })

  describe('loadScriptTag', () => {
    let addEventListenerSpy;
    let billableEvents = [];

    let config = cloneDeep(validModuleConfig);
    config.params.tagConfig = validTagConfig;

    events.on(CONSTANTS.EVENTS.BILLABLE_EVENT, (e) => {
      billableEvents.push(e);
    })

    beforeEach(() => {
      initializeModuleData(config);
      addEventListenerSpy = sinon.spy(window, 'addEventListener');
    })

    afterEach(() => {
      addEventListenerSpy.restore();
      billableEvents = [];
    })

    it('adds event listener', () => {
      loadScriptTag(config);
      expect(addEventListenerSpy.calledOnce).to.be.true;
    })

    it('parses incoming qortex-impression events', () => {
      loadScriptTag(config);
      dispatchEvent(new CustomEvent('qortex-rtd', validImpressionEvent));
      expect(billableEvents.length).to.be.equal(1);
      expect(billableEvents[0].type).to.be.equal(validImpressionEvent.detail.type);
      expect(billableEvents[0].transactionId).to.be.equal(validImpressionEvent.detail.uid);
    })

    it('will emit two events for impressions with two different ids', () => {
      loadScriptTag(config);
      dispatchEvent(new CustomEvent('qortex-rtd', validImpressionEvent));
      dispatchEvent(new CustomEvent('qortex-rtd', validImpressionEvent2));
      expect(billableEvents.length).to.be.equal(2);
      expect(billableEvents[0].transactionId).to.be.equal(validImpressionEvent.detail.uid);
      expect(billableEvents[1].transactionId).to.be.equal(validImpressionEvent2.detail.uid);
    })

    it('will not allow multiple events with the same id', () => {
      loadScriptTag(config);
      dispatchEvent(new CustomEvent('qortex-rtd', validImpressionEvent));
      dispatchEvent(new CustomEvent('qortex-rtd', validImpressionEvent));
      expect(billableEvents.length).to.be.equal(1);
      expect(logWarnSpy.calledWith('recieved invalid billable event due to duplicate uid: qx-impression')).to.be.ok;
    })

    it('will not allow events with missing uid', () => {
      loadScriptTag(config);
      dispatchEvent(new CustomEvent('qortex-rtd', missingIdImpressionEvent));
      expect(billableEvents.length).to.be.equal(0);
      expect(logWarnSpy.calledWith('recieved invalid billable event due to missing uid: qx-impression')).to.be.ok;
    })

    it('will not allow events with unavailable type', () => {
      loadScriptTag(config);
      dispatchEvent(new CustomEvent('qortex-rtd', invalidTypeQortexEvent));
      expect(billableEvents.length).to.be.equal(0);
      expect(logWarnSpy.calledWith('recieved invalid billable event: invalid-type')).to.be.ok;
    })
  })

  describe('getBidRequestData', () => {
    let callbackSpy;

    beforeEach(() => {
      initializeModuleData(validModuleConfig);
      callbackSpy = sinon.spy();
    })

    afterEach(() => {
      initializeModuleData(emptyModuleConfig);
      callbackSpy.resetHistory();
    })

    it('will call callback immediately if no adunits', () => {
      const reqBidsConfigNoBids = { adUnits: [] };
      module.getBidRequestData(reqBidsConfigNoBids, callbackSpy);
      expect(callbackSpy.calledOnce).to.be.true;
      expect(logWarnSpy.calledWith('No adunits found on request bids configuration: ' + JSON.stringify(reqBidsConfigNoBids))).to.be.ok;
    })

    it('will call callback if getContext does not throw', (done) => {
      module.getBidRequestData(reqBidsConfig, callbackSpy);
      setTimeout(() => {
        expect(ajaxSpy.calledOnce).to.be.true;
        expect(callbackSpy.calledOnce).to.be.true;
        done();
      }, 100)
    })

    it('will catch and log error and fire callback', (done) => {
      ajaxSpy.restore();
      sinon.stub(ajax, 'ajax').throws(new Error('test error'))
      module.getBidRequestData(reqBidsConfig, callbackSpy);
      setTimeout(() => {
        expect(callbackSpy.calledOnce).to.be.true;
        expect(logWarnSpy.calledWith('test error')).to.be.ok;
        done();
      }, 100)
    })
  })

  describe('getContext', () => {
    beforeEach(() => {
      initializeModuleData(validModuleConfig);
    })

    afterEach(() => {
      initializeModuleData(emptyModuleConfig);
    })

    it('returns a promise', () => {
      const result = getContext();
      expect(result).to.be.a('promise');
    })

    it('uses request url generated from initialize function in config and resolves to content object data', (done) => {
      let requestUrl = `${validModuleConfig.params.apiUrl}/api/v1/analyze/${validModuleConfig.params.groupId}/prebid`;
      getContext().then(response => {
        expect(response).to.be.eql(responseObj.content);
        expect(ajaxSpy.calledOnce).to.be.true;
        expect(ajaxSpy.calledWith(requestUrl)).to.be.true;

        expect(response).to.be.eql(responseObj.content);

        done();
      });
    })

    it('will return existing context data instead of ajax call if the source was not updated', (done) => {
      setContextData(responseObj.content);
      getContext().then(response => {
        expect(response).to.be.eql(responseObj.content);
        expect(ajaxSpy.calledOnce).to.be.false;
        done();
      })
    })

    it('returns null for non erroring api responses other than 200', (done) => {
      mockServer = sinon.createFakeServer();
      mockServer.respondWith([204, {content: null}, '']);
      mockServer.respondImmediately = true;
      mockServer.autoRespond = true;
      getContext().then(response => {
        expect(response).to.be.null;
        expect(ajaxSpy.calledOnce).to.be.true;
        expect(logWarnSpy.called).to.be.false;
        done();
      });
    })

    it('returns a promise that rejects to an Error if ajax errors', () => {
      mockServer = sinon.createFakeServer();
      mockServer.respondWith([500, {}, '']);
      mockServer.respondImmediately = true;
      mockServer.autoRespond = true;
      getContext().then().catch(err => {
        expect(err).to.be.an('error');
        done();
      })
    })
  })

  describe(' addContextToRequests', () => {
    it('logs error if no data was retrieved from get context call', () => {
      initializeModuleData(validModuleConfig);
      addContextToRequests(reqBidsConfig);
      expect(logWarnSpy.calledOnce).to.be.true;
      expect(logWarnSpy.calledWith('No context data recieved at this time')).to.be.ok;
      expect(reqBidsConfig.ortb2Fragments.global).to.be.eql({});
      expect(reqBidsConfig.ortb2Fragments.bidder).to.be.eql({});
    })

    it('adds site.content only to global ortb2 when bidders array is omitted', () => {
      const omittedBidderArrayConfig = cloneDeep(validModuleConfig);
      delete omittedBidderArrayConfig.params.bidders;
      initializeModuleData(omittedBidderArrayConfig);
      setContextData(responseObj.content);
      addContextToRequests(reqBidsConfig);
      expect(reqBidsConfig.ortb2Fragments.global).to.have.property('site');
      expect(reqBidsConfig.ortb2Fragments.global.site).to.have.property('content');
      expect(reqBidsConfig.ortb2Fragments.global.site.content).to.be.eql(responseObj.content);
      expect(reqBidsConfig.ortb2Fragments.bidder).to.be.eql({});
    })

    it('adds site.content only to bidder ortb2 when bidders array is included', () => {
      initializeModuleData(validModuleConfig);
      setContextData(responseObj.content);
      addContextToRequests(reqBidsConfig);

      const qortexOrtb2Fragment = reqBidsConfig.ortb2Fragments.bidder['qortex']
      expect(qortexOrtb2Fragment).to.not.be.null;
      expect(qortexOrtb2Fragment).to.have.property('site');
      expect(qortexOrtb2Fragment.site).to.have.property('content');
      expect(qortexOrtb2Fragment.site.content).to.be.eql(responseObj.content);

      const testOrtb2Fragment = reqBidsConfig.ortb2Fragments.bidder['test']
      expect(testOrtb2Fragment).to.not.be.null;
      expect(testOrtb2Fragment).to.have.property('site');
      expect(testOrtb2Fragment.site).to.have.property('content');
      expect(testOrtb2Fragment.site.content).to.be.eql(responseObj.content);

      expect(reqBidsConfig.ortb2Fragments.global).to.be.eql({});
    })

    it('logs error if there is an empty bidder array', () => {
      const invalidBidderArrayConfig = cloneDeep(validModuleConfig);
      invalidBidderArrayConfig.params.bidders = [];
      initializeModuleData(invalidBidderArrayConfig);
      setContextData(responseObj.content)
      addContextToRequests(reqBidsConfig);

      expect(logWarnSpy.calledWith('Config contains an empty bidders array, unable to determine which bids to enrich')).to.be.ok;
      expect(reqBidsConfig.ortb2Fragments.global).to.be.eql({});
      expect(reqBidsConfig.ortb2Fragments.bidder).to.be.eql({});
    })
  })
})
