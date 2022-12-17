import { submodule } from '../src/hook.js';
import { config } from '../src/config.js';
import { ajax } from '../src/ajax.js';
import {
  logError, mergeDeep, deepSetValue, logMessage
} from '../src/utils.js';

// const DEFAULT_API_URL = 'https://demand.catapultx.com';
// const DEFAULT_API_URL = 'https://localhost:5001';
const DEFAULT_API_URL = 'https://dev-demand.catapultx.com';

let extendedSiteContent = null;
let videoSrc = null;

const missingDataError = (description, location, object = null) => {
  logError(`CatapultX RTD module unable to comeplete because of ${description} missing from the ${location}: `, object)
  throw new Error();
};

/**
 * Init - if there are bidders we will at least init
 * @param {Object} config Module configuration
 * @param {boolean} userConsent
 * @returns true
 */
const init = (config, userConsent) => {
  if (config.params === undefined || config.params?.bidders === null || config.params?.bidders.length > 1) {
    logError('Prebid RTD module is not configured for any bidder')
    return false;
  } else if (!config.params?.videoContainer || config.params?.videoContainer.length < 1) {
    logError('Missing videoContainer param in module configuration')
    return false;
  }
  return true;
}

/**
 *
 * @param {Object} reqBidsConfig Bid request configuration object
 * @param {Function} callback Called on completion
 * @param {Object} moduleConfig 
 * @param {Object} userConsent
 */
const getBidRequestData = async (reqBidsConfig, callback, moduleConfig, userConsent) => {
  // logMessage("shiloh bids", JSON.stringify(reqBidsConfig.ortb2Fragments));
  // logMessage("shiloh metrics", JSON.stringify(reqBidsConfig), reqBidsConfig.metrics);
  const groupId = moduleConfig.params?.groupId || null;
  const apiUrl = moduleConfig.params?.apiUrl || DEFAULT_API_URL;
  const requestUrl = `${apiUrl}/api/v1/analyze/video/prebid`;
  const videoContainer = moduleConfig.params.videoContainer;
  getContext(requestUrl, groupId, videoSourceUpdated(videoContainer))
    .then(contextData => {
      extendedSiteContent = contextData;
      addContextDataToRequests(extendedSiteContent, reqBidsConfig, moduleConfig.params.bidders)
      callback();
    })
    .catch(() => {
      callback();
    });
}

const locateVideoUrl = (elem) => {
  logMessage('Looking for video source on element: ' + elem);
  let videoElement = document.querySelector(`#${elem},.${elem}`)?.querySelector('video');
  let videoSource = (typeof videoElement !== 'undefined' && videoElement !== null)?videoElement.src || videoElement.querySelector('source').src : null;
  if(videoSource !== null && videoSource !== ''){
    logMessage(`Video source '${videoSource}' found on node ${elem}`);
    return videoSource;
  }else{
    logMessage(`Video source not found (${videoElement})`);
    return null;
  }
}

const videoSourceUpdated = (elem) => {
  const currentVideoSource = locateVideoUrl(elem);
  if(videoSrc = currentVideoSource) {
    videoSrc = currentVideoSource;
    return false;
  } else {
    videoSrc = currentVideoSource;
    return true;
  }
}

const getContext = async (apiUrl, groupId, updated) => {
  if(videoSrc === null) {
    missingDataError('Video source url', 'Container location')
  } else if (updated || (!updated && !extendedSiteContent)){
    logMessage("Getting new context for video source");
    return new Promise((resolve, reject) => {
      const contextRequest = {
        groupId: groupId,
        videoUnits: [{videoUrl: videoSrc}]
      }
      const options = {
        contentType: 'application/json'
      }
      const callbacks = {
        success(text, data) {
          resolve(JSON.parse(data.response)[0].videoContent);
        },
        error(error) {
          reject(error)
        }
      }
      ajax(apiUrl, callbacks, JSON.stringify(contextRequest), options)
    })
  } else {
    logMessage("Adding context from previous content data with the same source");
    return new Promise(resolve => resolve(extendedSiteContent));
  }
}

/**
 * Merges the contextual data with the existing config for bidder and updates
 * @param {string} bidder Bidder for which to set config
 * @param {Object} contextData data from context endpoint
 * @param {Object} bidderConfigs All current bidder configs
 * @returns {Object} Updated bidder config
 */
export const createFragment = (bidder, contextData, bidderConfigs) => {
  const bidderConfigCopy = mergeDeep({}, bidderConfigs[bidder]);

  if(bidderConfigCopy === {} || !bidderConfigCopy.ortb2?.site?.content) {
    deepSetValue(bidderConfigCopy, 'ortb2.site.content', contextData)
  } else {
    const insert = {
      ortb2: {
        site: {
          content: contextData
        }
      }
    }
    mergeDeep(bidderConfigCopy, insert)
  }

  return bidderConfigCopy.ortb2;
};

/**
 * Updates bidder configs with the response from catapultx context services
 * @param {Object} contextData Response from context endpoint
 * @param {string[]} bidders Bidders specified in module's configuration
 */
export const addContextDataToRequests = (contextData, reqBidsConfig, bidders) => {
  if (!reqBidsConfig?.adUnits?.length || reqBidsConfig?.adUnits?.length < 1) {
    logError("sorry sorry sorry");
    // missingDataError('adUnits', 'prebid request', reqBidsConfig);
  }

  myCustomData =  
  { site: {
      content: contextData
    }
  }

  const bidderConfigs = config.getBidderConfig();

  for (const bidder of bidders) {
    logMessage('creating fragment for', bidder, contextData);
    const bidderOrtb2Fragment = createFragment(bidder, contextData, bidderConfigs);
    if (bidderOrtb2Fragment) {
      mergeDeep(reqBidsConfig.ortb2Fragments.bidder, {[bidder]: bidderOrtb2Fragment})
    }
  }

  // config.setConfig({ortb2:myCustomData})
  // mergeDeep(reqBidsConfig.ortb2Fragments.global, myCustomData);
  // mergeDeep(reqBidsConfig.ortb2Fragments.bidder, {});
  // logMessage("shiloh bids after", JSON.stringify(reqBidsConfig.ortb2Fragments));
}

// The RTD submodule object to be exported
export const catapultxSubmodule = {
  name: 'catapultx',
  init: init,
  getBidRequestData: getBidRequestData
}

// Register the catapultxSubmodule as submodule of realTimeData
submodule('realTimeData', catapultxSubmodule);
