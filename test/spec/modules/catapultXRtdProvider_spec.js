import { config } from 'src/config';
import * as utils from 'src/utils';
import * as ajax from 'src/ajax.js'
import * as rtd from 'modules/catapultxRtdProvider';
const module = rtd.catapultxSubmodule;

/* eslint no-console: 0 */

describe('catapultxRtdProvider', () => {
  let logErrorSpy;
  let mockServer;
  let ajaxSpy;
  let ortb2Stub;

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

  const videoSrc1 = 'http://hello.test.com/example.mp4',
    videoSrc2 = 'http://test.two.com/second.mp4',
    defaultApiHost = 'https://demand.catapultx.com';

  const reqBidsConfig = {
    adUnits: [{
      bids: [
        { bidder: 'catapultx' }
      ]
    }],
    ortb2Fragments: {
      bidder: {},
      global: {}
    }
  }

  const reqBidsConfigNoBids = {
    adUnits: []
  };

  const containerName = 'my-video-container';
  const validBidderArray = ['catapultx', 'test'];

  beforeEach(() => {
    mockServer = sinon.createFakeServer();
    mockServer.respondWith([200, responseHeaders, apiResponse]);
    mockServer.respondImmediately = true;
    mockServer.autoRespond = true;

    ortb2Stub = sinon.stub(reqBidsConfig, 'ortb2Fragments').value({bidder: {}, global: {}})
    logErrorSpy = sinon.spy(utils, 'logError');
    ajaxSpy = sinon.spy(ajax, 'ajax');
  })

  afterEach(() => {
    ajaxSpy.restore();
    logErrorSpy.restore();
    ortb2Stub.restore();
    mockServer.restore();
    resetGlobalData();
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
    return video;
  }

  const resetGlobalData = () => {
    rtd.setSrc(null);
    rtd.setContextData(null);
  }

  describe('init', () => {
    it('returns true for valid config object', () => {
      const config = { params: { groupId: 'test', videoContainer: containerName } };
      expect(module.init(config)).to.be.true;
    })

    it('returns true with valid optional parameters', () => {
      const config = { params: { groupId: 'test', videoContainer: containerName, apiUrl: defaultApiHost, bidders: validBidderArray } };
      expect(module.init(config)).to.be.true;
    })

    it('returns false and logs error for missing groupId', () => {
      const config = { params: { videoContainer: containerName } };
      expect(module.init(config)).to.be.false;
      expect(logErrorSpy.calledOnce).to.be.true;
      expect(logErrorSpy.calledWith('Catapultx RTD module config does not contain valid groupId parameter. Config params: ' + JSON.stringify(config.params)))
    })

    it('returns false and logs error for missing groupId', () => {
      const config = { params: { groupId: 'group1' } };
      expect(module.init(config)).to.be.false;
      expect(logErrorSpy.calledOnce).to.be.true;
      expect(logErrorSpy.calledWith('Catapultx RTD module config does not contain valid videoContainer parameter. Config params: ' + JSON.stringify(config.params)))
    })

    it('returns false for empty bidder array param', () => {
      const config = { params: { groupId: 'test', videoContainer: containerName, bidders: [] } };
      expect(module.init(config)).to.be.false;
      expect(logErrorSpy.calledOnce).to.be.true;
      expect(logErrorSpy.calledWith('Catapultx RTD module config contains empty bidder array, must either be omitted or have at least one bidder to continue'))
    })
  })

  describe('getBidRequestData', () => {
    let config;
    let callbackSpy;

    beforeEach(() => {
      config = { params: { groupId: 'test', videoContainer: containerName } };
      callbackSpy = sinon.spy();
    })

    afterEach(() => {
      callbackSpy.resetHistory();
    })

    it('will call callback immediately if no adunits', () => {
      module.getBidRequestData(reqBidsConfigNoBids, callbackSpy, config);
      expect(callbackSpy.calledOnce).to.be.true;
      expect(logErrorSpy.calledWith('No adunits found on request bids configuration: ' + JSON.stringify(reqBidsConfigNoBids)))
    })

    it('will log error and call callback if container lookup returns no source', (done) => {
      module.getBidRequestData(reqBidsConfig, callbackSpy, config);
      setTimeout(() => {
        expect(logErrorSpy.calledOnce).to.be.true;
        expect(logErrorSpy.calledWith('CatapultX RTD module unable to complete because Video source url missing on provided container node'))
        expect(callbackSpy.calledOnce).to.be.true;
        done();
      }, 100)
    })

    it('will attempt add to context and then call callback if getContext does not throw', (done) => {
      const container = addContainer(containerName);
      addVideoElement(container, videoSrc1)
      module.getBidRequestData(reqBidsConfig, callbackSpy, config);
      container.remove();
      setTimeout(() => {
        expect(ajaxSpy.calledOnce).to.be.true;
        expect(callbackSpy.calledOnce).to.be.true;
        expect(reqBidsConfig.ortb2Fragments.global.site.content).to.not.be.null;
        done();
      }, 100)
    })

    it('gracefully handles null apiurl and bidders array', (done) => {
      const container = addContainer(containerName);
      addVideoElement(container, videoSrc1);
      module.getBidRequestData(reqBidsConfig, callbackSpy, config);
      container.remove();
      setTimeout(() => {
        expect(mockServer.requests[0].url).to.be.eql(defaultApiHost + '/api/v1/analyze/video/prebid')
        expect(reqBidsConfig.ortb2Fragments.global.site.content).to.not.be.null;
        expect(reqBidsConfig.ortb2Fragments.bidder).to.be.eql({});
        done();
      }, 100);
    })

    it('properly parses optional parameters', (done) => {
      const alternateApiHost = 'https://test.catapultx.com'
      const container = addContainer(containerName);
      addVideoElement(container, videoSrc1)
      config.params.apiUrl = alternateApiHost;
      config.params.bidders = validBidderArray
      module.getBidRequestData(reqBidsConfig, callbackSpy, config);
      container.remove();
      setTimeout(() => {
        expect(mockServer.requests[0].url).to.be.eql(alternateApiHost + '/api/v1/analyze/video/prebid')
        const bidders = Object.keys(reqBidsConfig.ortb2Fragments.bidder);
        expect(bidders).to.be.eql(config.params.bidders);
        expect(bidders.length).to.be.eql(2);
        done();
      }, 100)
    })
  })

  describe('locateVideoUrl', () => {
    it('locates video source on valid container node with video object', () => {
      const container = addContainer(containerName);
      addVideoElement(container, videoSrc1)
      const result = rtd.locateVideoUrl(containerName);
      expect(result).to.be.equal(videoSrc1);
      container.remove();
    })

    it('finds new video source on same container in between lookups', () => {
      const container = addContainer(containerName);
      const video = addVideoElement(container, videoSrc1)
      const firstVideo = rtd.locateVideoUrl(containerName);
      expect(firstVideo).to.be.equal(videoSrc1);
      video.src = videoSrc2;
      const secondVideo = rtd.locateVideoUrl(containerName);
      expect(secondVideo).to.be.equal(videoSrc2);
      container.remove();
    })

    it('returns null for container with no video element', () => {
      const container = addContainer(containerName);
      const result = rtd.locateVideoUrl(containerName);
      expect(result).to.be.null;
      container.remove();
    })

    it('returns null for container with video element with no source', () => {
      const container = addContainer(containerName);
      addVideoElement(container)
      const result = rtd.locateVideoUrl(containerName);
      expect(result).to.be.null;
      container.remove();
    })

    it('returns null for no container', () => {
      const result = rtd.locateVideoUrl(containerName);
      expect(result).to.be.null;
    })
  })

  describe('videoSourceUpdated', () => {
    it('returns true when container with video source is added', () => {
      const container = addContainer(containerName);
      addVideoElement(container, videoSrc1)
      const result = rtd.videoSourceUpdated(containerName);
      expect(result).to.be.true;
      container.remove();
    })

    it('returns true when video source is updated', () => {
      const container = addContainer(containerName);
      const video = addVideoElement(container, videoSrc1)
      const firstUpdate = rtd.videoSourceUpdated(containerName);
      expect(firstUpdate).to.be.true;
      video.src = videoSrc2;
      const secondUpdate = rtd.videoSourceUpdated(containerName);
      expect(secondUpdate).to.be.true;
      container.remove();
    })

    it('returns true when source is updated to null', () => {
      const container = addContainer(containerName);
      const video = addVideoElement(container, videoSrc1)
      const updatedToUrlResult = rtd.videoSourceUpdated(containerName);
      expect(updatedToUrlResult).to.be.true;
      video.remove();
      const updatedToNullResult = rtd.videoSourceUpdated(containerName);
      expect(updatedToNullResult).to.be.true;
      container.remove();
    })

    it('returns false when source is never updated from null', () => {
      const container = addContainer(containerName);
      const result = rtd.videoSourceUpdated(containerName);
      expect(result).to.eql(false);
      container.remove();
    })

    it('returns false when a video source has not been updated', () => {
      const container = addContainer(containerName);
      addVideoElement(container, videoSrc1)
      const firstCall = rtd.videoSourceUpdated(containerName);
      expect(firstCall).to.be.true;
      const secondCall = rtd.videoSourceUpdated(containerName);
      expect(secondCall).to.be.false;
      container.remove();
    })
  })

  describe('getContext', () => {
    const requestUrl = defaultApiHost + '/api/v1/analyze/video/prebid';
    const groupId = 'groupId';
    let updated;

    beforeEach(() => {
      updated = true;
    })

    it('returns a promise that rejects to an Error if pipeline is unable to detect a video src', (done) => {
      const result = rtd.getContext(requestUrl, groupId, updated);
      expect(result).to.be.a('promise');
      result.then().catch(err => {
        expect(err).to.be.an('error');
        expect(err.message).to.be.eql('CatapultX RTD module unable to complete because Video source url missing on provided container node');
        done();
      })
    })

    it('creates ajax request and returns promise with result video source is updated', (done) => {
      rtd.setSrc(videoSrc1);
      rtd.getContext(requestUrl, groupId, updated).then(response => {
        expect(response).to.be.eql(responseObj.videoContent);
        expect(ajaxSpy.calledOnce).to.be.true;
        expect(ajaxSpy.calledWith(requestUrl)).to.be.true;

        const parsedRequest = JSON.parse(mockServer.requests[0].requestBody);

        expect(parsedRequest).to.have.property('groupId');
        expect(parsedRequest.groupId).to.be.eql('groupId');
        expect(parsedRequest).to.have.property('videoUrl');
        expect(parsedRequest.videoUrl).to.be.eql(videoSrc1);

        done();
      })
    })

    it('will intiate ajax if source is not updated but there is no global context data set', (done) => {
      rtd.setSrc(videoSrc1);
      updated = false;
      rtd.getContext(requestUrl, groupId, updated).then(response => {
        expect(response).to.be.eql(responseObj.videoContent);
        expect(ajaxSpy.calledOnce).to.be.true;
        done();
      })
    })

    it('will return existing context data instead of ajax call if the source was not updated', (done) => {
      rtd.setSrc(videoSrc1);
      rtd.setContextData(responseObj.videoContent);
      updated = false;
      rtd.getContext(requestUrl, groupId, updated).then(response => {
        expect(response).to.be.eql(responseObj.videoContent);
        expect(ajaxSpy.calledOnce).to.be.false;
        done();
      })
    })

    it('returns null for non erroring api responses other than 200', (done) => {
      mockServer = sinon.createFakeServer();
      mockServer.respondWith([204, {}, '']);
      mockServer.respondImmediately = true;
      mockServer.autoRespond = true;
      rtd.setSrc(videoSrc1);
      rtd.getContext(requestUrl, groupId, updated).then(response => {
        expect(response).to.be.null;
        expect(ajaxSpy.calledOnce).to.be.true;
        expect(logErrorSpy.called).to.be.false;
        done();
      });
    })

    it('returns a promise that rejects to an Error if ajax errors', () => {
      mockServer = sinon.createFakeServer();
      mockServer.respondWith([404, {}, '']);
      mockServer.respondImmediately = true;
      mockServer.autoRespond = true;
      rtd.setSrc(videoSrc1);
      rtd.getContext(requestUrl, groupId, updated).then().catch(err => {
        expect(err).to.be.an('error');
        expect(err.message).to.be.eql('Not Found');
        done();
      })
    })
  })

  describe(' addContextToRequests', () => {
    beforeEach(() => {
      rtd.setSrc(videoSrc1);
    })

    it('logs error if no data was retrieved from get context call', () => {
      rtd.addContextToRequests(reqBidsConfig);
      expect(logErrorSpy.calledOnce).to.be.true;
      expect(logErrorSpy.calledWith('No context data recieved at this time for url: ' + videoSrc1))
      expect(reqBidsConfig.ortb2Fragments.global).to.be.eql({});
      expect(reqBidsConfig.ortb2Fragments.bidder).to.be.eql({});
    })

    it('adds site.content only to global ortb2 when bidders array is omitted', () => {
      rtd.setContextData(responseObj.videoContent);
      rtd.addContextToRequests(reqBidsConfig);
      expect(reqBidsConfig.ortb2Fragments.global).to.have.property('site');
      expect(reqBidsConfig.ortb2Fragments.global.site).to.have.property('content');
      expect(reqBidsConfig.ortb2Fragments.global.site.content).to.be.eql(responseObj.videoContent);
      expect(reqBidsConfig.ortb2Fragments.bidder).to.be.eql({});
    })

    it('adds site.content only to bidder ortb2 when bidders array is omitted', () => {
      const bidders = validBidderArray
      rtd.setContextData(responseObj.videoContent);
      rtd.addContextToRequests(reqBidsConfig, bidders);

      const catapultXOrtb2Fragment = reqBidsConfig.ortb2Fragments.bidder['catapultx']
      expect(catapultXOrtb2Fragment).to.not.be.null;
      expect(catapultXOrtb2Fragment).to.have.property('site');
      expect(catapultXOrtb2Fragment.site).to.have.property('content');
      expect(catapultXOrtb2Fragment.site.content).to.be.eql(responseObj.videoContent);

      const testOrtb2Fragment = reqBidsConfig.ortb2Fragments.bidder['test']
      expect(testOrtb2Fragment).to.not.be.null;
      expect(testOrtb2Fragment).to.have.property('site');
      expect(testOrtb2Fragment.site).to.have.property('content');
      expect(testOrtb2Fragment.site.content).to.be.eql(responseObj.videoContent);

      expect(reqBidsConfig.ortb2Fragments.global).to.be.eql({});
    })
  })
})
