import { submodule } from '../src/hook.js';
import { config } from '../src/config.js';
import { ajax } from '../src/ajax.js';
import {
  logError, mergeDeep, deepSetValue, logMessage
} from '../src/utils.js';

// const DEFAULT_API_URL = 'https://demand.catapultx.com';
// const DEFAULT_API_URL = 'https://localhost:5001';
const DEFAULT_API_URL = 'https://dev-demand.catapultx.com';

const initializedTime = (new Date()).getTime();
let extendedSiteContent = null;
let videoSrc = null;

const missingDataError = (description, location, object) => {
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
  locateVideoUrl(config.params.videoContainer);
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
  if (!reqBidsConfig?.adUnits?.length || reqBidsConfig?.adUnits?.length < 1) {
    logError('No adUnits present in prebid request', reqBidsConfig);
    callback();
  } else {
    try {
      const apiUrl = moduleConfig.params?.apiUrl || DEFAULT_API_URL;
      const requestUrl = `${apiUrl}/api/v1/analyze/video/prebid`;
      getContext(requestUrl, videoSrc)
      .then(contextData => {
        addContextDataToRequests(contextData, reqBidsConfig, bidders)
        callback()
      });
    } catch (error) {
      logError('[cx data module]', error);
      callback();
    }
  }
}

const locateVideoUrl = (elem) => {
  logMessage('Looking for video source on element: ' + elem);
  let videoElement = document.querySelector(`#${elem},.${elem}`)?.querySelector('video');
  let videoSource = (typeof videoElement !== 'undefined' && videoElement !== null)?videoElement.src || videoElement.querySelector('source').src : null;
  if(videoSource !== null && videoSource !== ''){
    logMessage(`Video source '${videoSource}' found on node ${elem}`);
    videoSrc = videoSource;
    return;
  }else{
    logMessage(`Video source not found (${videoElement})`);
    if((new Date()).getTime() - initializedTime < 1000){
      setTimeout(()=>{locateVideoSrc(elem)}, 250);
    }
    return;
  }
}

const getContext = async (apiUrl, groupId, videoSrc) => {
  return new Promise((resolve, reject) => {
    const contextRequest = {
      groupId: groupId,
      videoUnits: [{adUnitCode: 'test', bidder: 'catapultx', videoUrl: videoSrc}]
    }
    const options = {
      contentType: 'application/json'
    }
    const callbacks = {
      success(text, data) {
        resolve(JSON.parse(data.response));
      },
      error(error) {
        reject(error)
      }
    }
    ajax(apiUrl, callbacks, JSON.stringify(contextRequest), options)
  })
}

// we will probably want to have this for support purposes
// !!!! currently not implemented
/**
 * Extracts consent from the prebid consent object
 * @param {object} prebid gdpr object
 * @returns dictionary of papi gdpr query parameters
 */
export const extractConsent = ({ gdpr }) => {
  if (!gdpr) {
    return null
  }
  const { gdprApplies, consentString } = gdpr
  if (!(gdprApplies == '0' || gdprApplies == '1')) {
    throw 'TCF Consent: gdprApplies has wrong format'
  }
  if (consentString && typeof consentString != 'string') {
    throw 'TCF Consent: consentString must be string if defined'
  }
  const result = {
    'gdpr_applies': gdprApplies,
    'consent_string': consentString
  }
  return result
}

/**
 * Merges the targeting data with the existing config for bidder and updates
 * @param {string} bidder Bidder for which to set config
 * @param {Object} bidderContent selected content object to be added
 * @param {Object} bidderConfigs All current bidder configs
 * @returns {Object} Updated bidder config
 */
export const updateBidderConfig = (bidder, bidderContent, bidderConfigs) => {
  const bidderConfigCopy = mergeDeep({}, bidderConfigs[bidder]);

  if(bidderConfigCopy === {} || !bidderConfigCopy.ortb2?.site?.content) {
    deepSetValue(bidderConfigCopy, 'ortb2.site.content', bidderContent)
  } else {
    const insert = {
      ortb2: {
        site: {
          content: bidderContent
        }
      }
    }
    mergeDeep(bidderConfigCopy, insert)
  }

  return bidderConfigCopy;
};

/**
 * Updates bidder configs with the targeting data retreived from Profile API
 * @param {Object} contextData Response from context endpoint
 * @param {Object} reqBidsConfig request bids configuration
 * @param {string[]} cbidders Bidders specified in module's configuration
 */
export const addContextDataToRequests = (contextData, reqBidsConfig, bidders) => {
  const bidderConfigs = config.getBidderConfig();

  for (const bidder of bidders) {
    const bidderContent = contextData.find(x => x.bidder === bidder);
    const updatedBidderOrtb2 = updateBidderConfig(bidder, bidderContent.videoContent, bidderConfigs);
    if (updatedBidderOrtb2) {
      mergeDeep(reqBidsConfig.ortb2Fragments.bidder, {[bidder]: updatedBidderOrtb2.ortb2})
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
