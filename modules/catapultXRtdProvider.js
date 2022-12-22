import { submodule } from '../src/hook.js';
import { ajax } from '../src/ajax.js';
import {
  logError, mergeDeep, logMessage
} from '../src/utils.js';

// const DEFAULT_API_URL = 'https://localhost:5001';
const DEFAULT_API_URL = 'https://dev-demand.catapultx.com';

let extendedSiteContent = null;
let videoSrc = null;

/**
 * Init if module configuration is valid
 * @param {Object} config Module configuration
 * @returns {Boolean}
 */
const init = (config) => {
  if (!config.params || !config.params?.videoContainer) {
    logError('Catapultx RTD module is not configured properly')
    return false;
  }
  return true;
}

/**
 *
 * @param {Object} reqBidsConfig Bid request configuration object
 * @param {Function} callback Called on completion
 * @param {Object} moduleConfig
 */
const getBidRequestData = async (reqBidsConfig, callback, moduleConfig) => {
  const {apiUrl, videoContainer, bidders} = moduleConfig.params;
  const requestUrl = `${apiUrl || DEFAULT_API_URL}/api/v1/analyze/video/prebid`;
  getContext(requestUrl, videoSourceUpdated(videoContainer))
    .then(contextData => {
      extendedSiteContent = contextData;
      addContextDataToRequests(extendedSiteContent, reqBidsConfig, bidders)
      callback();
    })
    .catch(() => {
      callback();
    });
}

const locateVideoUrl = (elem) => {
  logMessage('Looking for video source on node: ' + elem);
  let videoElement = document.querySelector(`#${elem},.${elem}`)?.querySelector('video');
  let newVideoSource = (typeof videoElement !== 'undefined' && videoElement !== null)?videoElement.src || videoElement.querySelector('source').src : null;
  if(newVideoSource !== null && newVideoSource !== ''){
    logMessage(`Video source '${newVideoSource}' found on node ${elem}`);
    return newVideoSource;
  }else{
    logMessage(`No video source found on node: ${elem}. Lookup returned the following element: ${videoElement}`);
    return null;
  }
}

const videoSourceUpdated = (elem) => {
  const currentVideoSource = locateVideoUrl(elem);
  if(videoSrc === currentVideoSource) {
    videoSrc = currentVideoSource;
    return false;
  } else {
    videoSrc = currentVideoSource;
    return true;
  }
}

const getContext = async (apiUrl, updated) => {
  if(videoSrc === null) {
    logError(`CatapultX RTD module unable to comeplete because Video source url missing on provided container node`)
    throw new Error();
  } else if (updated || (!updated && !extendedSiteContent)){
    logMessage("Requesting new context data");
    return new Promise((resolve, reject) => {
      const contextRequest = {
        videoUrl: videoSrc
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
    logMessage("Adding Content object from existing context data with the same source");
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
  if(contextData === null) {
    logError('No context data recieved at this time for url: ' + videoSrc);
  } else if (!reqBidsConfig?.adUnits?.length > 0) {
    logError('No adunits found on request bids configuration: ' + reqBidsConfig);
  } else {
    const fragment = { site: {content: contextData} }
    if(bidders){
      bidders.forEach(bidder => mergeDeep(reqBidsConfig.ortb2Fragments.bidder, {[bidder]: fragment}))
    } else {
      mergeDeep(reqBidsConfig.ortb2Fragments.global, fragment);
    }
  }
}

// The RTD submodule object to be exported
export const catapultxSubmodule = {
  name: 'catapultx',
  init: init,
  getBidRequestData: getBidRequestData
}

// Register the catapultxSubmodule as submodule of realTimeData
submodule('realTimeData', catapultxSubmodule);