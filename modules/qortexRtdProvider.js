import { submodule } from '../src/hook.js';
import { ajax } from '../src/ajax.js';
import { logError, mergeDeep, logMessage } from '../src/utils.js';
import { loadExternalScript } from '../src/adloader.js';

const DEFAULT_API_URL = 'https://demand.qortex.ai';

let currentSiteContext = null;
let videoSrc = null;

/**
 * Init if module configuration is valid
 * @param {Object} config Module configuration
 * @returns {Boolean}
 */
function init (config) {
  if (!config?.params?.groupId?.length > 0) {
    logError('qortex RTD module config does not contain valid groupId parameter. Config params: ' + JSON.stringify(config.params))
    return false;
  }  
  if (config?.params?.tagConfig) {
    loadScriptTag(config)
  }
  if (!config?.params?.videoContainer?.length > 0) {
    logError('qortex RTD module config does not contain valid videoContainer parameter. Config params: ' + JSON.stringify(config.params))
    return false;
  } else if (config?.params?.bidders?.length === 0) {
    logError('qortex RTD module config contains empty bidder array, must either be omitted or have at least one bidder to continue');
    return false;
  }
  return true;
}

function loadScriptTag(config) {
  const code = 'qortex'
  const src = 'https://tags.qortex.ai/bootstrapper'
  const attr = {'data-group-id': config.params.groupId}
  const tc = config.params.tagConfig
  Object.keys(tc).forEach(p => {
    attr[`data-${p.replace(/([A-Z])/g,(m)=>`-${m.toLowerCase()}`)}`]=tc[p]
  })
  loadExternalScript(src, code, undefined, undefined, attr);
}

/**
 * Processess prebid request and attempts to add context to ort2b fragments
 * @param {Object} reqBidsConfig Bid request configuration object
 * @param {Function} callback Called on completion
 * @param {Object} moduleConfig
 */
function getBidRequestData (reqBidsConfig, callback, moduleConfig) {
  if (reqBidsConfig?.adUnits?.length > 0) {
    const {apiUrl, videoContainer, bidders, groupId} = moduleConfig.params;
    const requestUrl = `${apiUrl || DEFAULT_API_URL}/api/v1/analyze/video/prebid`;
    getContext(requestUrl, groupId, videoSourceUpdated(videoContainer))
      .then(contextData => {
        setContextData(contextData)
        addContextToRequests(reqBidsConfig, bidders)
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
export function locateVideoUrl (elem) {
  logMessage('Looking for video source on node: ' + elem);
  let videoElement = document.querySelector(`#${elem},.${elem}`)?.querySelector('video');
  let newVideoSource = (typeof videoElement !== 'undefined' && videoElement !== null) ? videoElement?.src || videoElement.querySelector('source')?.src : null;
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
export function videoSourceUpdated (videoContainer) {
  const currentVideoSource = locateVideoUrl(videoContainer);
  if (videoSrc === currentVideoSource) {
    setSrc(currentVideoSource);
    return false;
  } else {
    setSrc(currentVideoSource);
    return true;
  }
}

/**
 * determines whether to send a request to context api and does so if necessary
 * @param {String} requestUrl qortex context api url
 * @param {String} groupId qortex publisher groupId
 * @param {Boolean} updated boolean indicating whether or not the video source url has changed since last lookup in runtime
 * @returns {Promise} ortb Content object
 */
export function getContext (requestUrl, groupId, updated) {
  if (videoSrc === null) {
    return new Promise((resolve, reject) => reject(new Error('qortex RTD module unable to complete because Video source url missing on provided container node')));
  } else if (updated || (!updated && !currentSiteContext)) {
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
          reject(new Error(error));
        }
      }
      ajax(requestUrl, callbacks, JSON.stringify(contextRequest), options)
    })
  } else {
    logMessage('Adding Content object from existing context data with the same source');
    return new Promise(resolve => resolve(currentSiteContext));
  }
}

/**
 * Updates bidder configs with the response from qortex context services
 * @param {Object} reqBidsConfig Bid request configuration object
 * @param {string[]} bidders Bidders specified in module's configuration
 */
export function addContextToRequests (reqBidsConfig, bidders) {
  if (currentSiteContext === null) {
    logError('No context data recieved at this time for url: ' + videoSrc);
  } else {
    const fragment = { site: {content: currentSiteContext} }
    if (bidders) {
      bidders.forEach(bidder => mergeDeep(reqBidsConfig.ortb2Fragments.bidder, {[bidder]: fragment}))
    } else {
      mergeDeep(reqBidsConfig.ortb2Fragments.global, fragment);
    }
  }
}

export function setSrc(value) {
  videoSrc = value
}

export function setContextData(value) {
  currentSiteContext = value
}

export const qortexSubmodule = {
  name: 'qortex',
  init,
  getBidRequestData
}

submodule('realTimeData', qortexSubmodule);
