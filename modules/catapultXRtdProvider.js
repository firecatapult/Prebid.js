import { submodule } from '../src/hook.js';
import { ajax } from '../src/ajax.js';
import { logError, mergeDeep, logMessage } from '../src/utils.js';

const DEFAULT_API_URL = 'https://demand.catapultx.com';

let extendedSiteContent = null;
let videoSrc = null;

/**
 * Init if module configuration is valid
 * @param {Object} config Module configuration
 * @returns {Boolean}
 */
const init = (config) => {
  if (!config?.params?.groupId?.length > 0) {
    logError('Catapultx RTD module config does not contain valid groupId parameter. Config params: ' + JSON.stringify(config.params))
    return false;
  } else if (!config?.params?.videoContainer?.length > 0) {
    logError('Catapultx RTD module config does not contain valid videoContainer parameter. Config params: ' + JSON.stringify(config.params))
    return false;
  }
  return true;
}

/**
 * Processess prebid request and attempts to add context to ort2b fragments
 * @param {Object} reqBidsConfig Bid request configuration object
 * @param {Function} callback Called on completion
 * @param {Object} moduleConfig
 */
const getBidRequestData = (reqBidsConfig, callback, moduleConfig) => {
  if (reqBidsConfig?.adUnits?.length > 0) {
    const {apiUrl, videoContainer, bidders, groupId} = moduleConfig.params;
    const requestUrl = `${apiUrl || DEFAULT_API_URL}/api/v1/analyze/video/prebid`;
    getContext(requestUrl, groupId, videoSourceUpdated(videoContainer))
      .then(contextData => {
        extendedSiteContent = contextData;
        addContextDataToRequests(extendedSiteContent, reqBidsConfig, bidders)
        callback();
      })
      .catch((e) => {
        logError(e.message);
        callback();
      });
  } else {
    logError('No adunits found on request bids configuration: ' + JSON.stringify(reqBidsConfig))
    callback();
  }
}

/**
 * Searches within the target container for a video element and returns the source if possible
 * @param {String} elem container name provided in module config, element to be searched for
 * @returns {String} url found in container src or null
 */
export const locateVideoUrl = (elem) => {
  logMessage('Looking for video source on node: ' + elem);
  let videoElement = document.querySelector(`#${elem},.${elem}`)?.querySelector('video');
  let newVideoSource = (typeof videoElement !== 'undefined' && videoElement !== null) ? videoElement.src || videoElement.querySelector('source').src : null;
  if (newVideoSource?.length > 0) {
    logMessage(`Video source '${newVideoSource}' found on node ${elem}`);
    return newVideoSource;
  } else {
    logMessage(`No video source found on node: ${elem}. Lookup returned the following element: ${videoElement}`);
    return null;
  }
}

/**
 * Determines whether or not the target video source has changed
 * @param {String} videoContainer container name provided in module config
 * @returns {Boolean}
 */
export const videoSourceUpdated = (videoContainer) => {
  const currentVideoSource = locateVideoUrl(videoContainer);
  if (videoSrc === currentVideoSource) {
    videoSrc = currentVideoSource;
    return false;
  } else {
    videoSrc = currentVideoSource;
    return true;
  }
}

/**
 * determines whether to send a request to context api and does so if necessary
 * @param {String} apiUrl catapultx context api url
 * @param {String} groupId catapultx publisher groupId
 * @param {Boolean} updated boolean indicating whether or not the video source url has changed since last lookup in runtime
 * @returns {Promise} ortb Content object
 */
export const getContext = (apiUrl, groupId, updated) => {
  if (videoSrc === null) {
    throw new Error('CatapultX RTD module unable to complete because Video source url missing on provided container node');
  } else if (updated || (!updated && !extendedSiteContent)) {
    logMessage('Requesting new context data');
    return new Promise((resolve, reject) => {
      const contextRequest = {
        videoUrl: videoSrc,
        groupId: groupId
      }
      const options = {
        contentType: 'application/json'
      }
      const callbacks = {
        success(text, data) {
          const result = data.status === 200 ? JSON.parse(data.response).videoContent : null;
          resolve(result);
        },
        error(error) {
          reject(error)
        }
      }
      ajax(apiUrl, callbacks, JSON.stringify(contextRequest), options)
    })
  } else {
    logMessage('Adding Content object from existing context data with the same source');
    return new Promise(resolve => resolve(extendedSiteContent));
  }
}

/**
 * Updates bidder configs with the response from catapultx context services
 * @param {Object} contextData Response from context endpoint
 * @param {Object} reqBidsConfig Bid request configuration object
 * @param {string[]} bidders Bidders specified in module's configuration
 */
export const addContextDataToRequests = (contextData, reqBidsConfig, bidders) => {
  if (contextData === null) {
    logError('No context data recieved at this time for url: ' + videoSrc);
  } else {
    const fragment = { site: {content: contextData} }
    if (bidders) {
      bidders.forEach(bidder => mergeDeep(reqBidsConfig.ortb2Fragments.bidder, {[bidder]: fragment}))
    } else {
      mergeDeep(reqBidsConfig.ortb2Fragments.global, fragment);
    }
  }
}

export const catapultxSubmodule = {
  name: 'catapultx',
  init,
  getBidRequestData
}

submodule('realTimeData', catapultxSubmodule);