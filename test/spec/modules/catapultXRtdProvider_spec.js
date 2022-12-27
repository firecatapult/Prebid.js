import { config } from 'src/config';
import * as utils from 'src/utils';
import * as rtd from 'modules/catapultxRtdProvider';
const module = rtd.catapultxSubmodule;

/* eslint no-console: ["error", { allow: ["log", "warn", "error"] }] */

describe('catapultxRtdProvider', () => {
  let logErrorSpy;
  let mockServer;

  const responseHeaders = {
      'content-type': 'application/json',
      'access-control-allow-origin': '*'
    },
    responseObj = {
      videoContent: {
        id: '123456',
        episode: 15,
        title: 'test episode',
        series: 'test show',
        season: '1',
        url: 'https://example.com/file.mp4'
      }
    },
    apiResponse = JSON.stringify(responseObj);

  const reqBidsConfig = {
      adUnits: [{
        bids: [
          { bidder: 'catapultx' }
        ]
      }]
    },
    reqBidsConfigNoBids = {
      adUnits: []
    };

  beforeEach(() => {
    // mockServer = sinon.createFakeServer();
    // mockServer.respondWith("POST", "*", [200, responseHeaders, apiResponse]);
    // mockServer.respondImmediately = true;
    // mockServer.autoRespond = true;
    logErrorSpy = sinon.spy(utils, 'logError');
  })

  afterEach(() => {
    logErrorSpy.restore();
    // will we set bidder config maybe im not sure
    config.resetConfig();
  })

  const addContainer = (name) => {
    const container = document.createElement(name);
    container.id = name;
    document.body.appendChild(container);
    return container;
  }

  const addVideoElement = (container, videoSource = null) => {
    const video = document.createElement('video');
    if (videoSource) {
      video.src = `${videoSource}`;
    }
    container.appendChild(video);
  }

  describe('init', () => {
    it('returns true for valid config object', () => {
      const config = { params: { groupId: 'test', videoContainer: 'my-video-container' } };
      expect(module.init(config)).to.be.true;
    })

    it('returns false and throws error for missing groupId', () => {
      const config = { params: { videoContainer: 'my-video-container' } };
      expect(module.init(config)).to.be.false;
      expect(logErrorSpy.calledOnce).to.be.true;
      expect(logErrorSpy.calledWith('Catapultx RTD module config does not contain valid groupId parameter. Config params: ' + JSON.stringify(config.params)))
    })

    it('returns false and throws error for missing groupId', () => {
      const config = { params: { groupId: 'group1' } };
      expect(module.init(config)).to.be.false;
      expect(logErrorSpy.calledOnce).to.be.true;
      expect(logErrorSpy.calledWith('Catapultx RTD module config does not contain valid videoContainer parameter. Config params: ' + JSON.stringify(config.params)))
    })
  })

  describe('getBidRequestData', () => {
    let config;
    let callbackSpy;
    let getContextSpy;
    let addContextSpy;

    beforeEach(() => {
      config = { params: { groupId: 'test', videoContainer: 'my-video-container' } };
      callbackSpy = sinon.spy();
      getContextSpy = sinon.spy(rtd, 'getContext')
      addContextSpy = sinon.spy(rtd, 'addContextDataToRequests');
    })

    afterEach(() => {
      callbackSpy.resetHistory();
      getContextSpy.restore();
      addContextSpy.restore();
    })

    it('will call callback immediately if no adunits', () => {
      module.getBidRequestData(reqBidsConfigNoBids, callbackSpy, config);
      expect(callbackSpy.calledOnce).to.be.true;
      expect(logErrorSpy.calledWith('No adunits found on request bids configuration: ' + JSON.stringify(reqBidsConfigNoBids)))
    })

    it('will attempt add to context and then call callback if getContext does not throw', () => {
      const container = addContainer('my-video-container');
      addVideoElement(container, 'test-src.com/test.mp4')
      module.getBidRequestData(reqBidsConfig, callbackSpy, config);
      setTimeout(() => {
        expect(addContextSpy.calledOnce).to.be.true;
        expect(callbackSpy.calledOnce).to.be.true;
      }, 100)
    })

    it('will log error and call callback if container lookup returns no source', () => {
      module.getBidRequestData(reqBidsConfig, callbackSpy, config);
      setTimeout(() => {
        expect(logErrorSpy.calledOnce).to.be.true;
        expect(logErrorSpy.calledWith('CatapultX RTD module unable to complete because Video source url missing on provided container node'));
        expect(callbackSpy.calledOnce).to.be.true;
      })
    })

    it('gracefully handles null apiurl and bidders array', () => {
      const container = addContainer('my-video-container');
      addVideoElement(container, 'test-src.com/test.mp4')
      module.getBidRequestData(reqBidsConfig, callbackSpy, config);
      setTimeout(() => {
        expect(getContextSpy.calledWith('test', 'https://demand.catapultx.com/api/v1/analyze/video/prebid', true)).to.be.true;
        expect(addContextSpy.calledWith(responseObj, reqBidsConfig, null)).to.be.true;
      }, 100)
    })

    it('properly parses optional parameters', () => {
      const container = addContainer('my-video-container');
      addVideoElement(container, 'test-src.com/test.mp4')
      config.params.apiUrl = 'https://test.com';
      config.params.bidders = ['catapultx', 'test']
      module.getBidRequestData(reqBidsConfig, callbackSpy, config);
      setTimeout(() => {
        expect(getContextSpy.calledWith('test', 'https://test.com/api/v1/analyze/video/prebid', true)).to.be.true;
        expect(addContextSpy.calledWith(responseObj, reqBidsConfig, ['catapultx', 'test'])).to.be.true;
      }, 100)
    })
  })

  describe('locateVideoUrl', () => {
    it('locates video source on valid container node with video object', () => {
      const container = addContainer('my-video-container');
      addVideoElement(container, "https://hello.test.com")
      const result = rtd.locateVideoUrl('my-video-container');
      expect(result).to.be.equal('https://hello.test-src.com');
    })
  })

  describe('getContext', () => {})
  describe('addContextDataToRequests', () => {})
})
