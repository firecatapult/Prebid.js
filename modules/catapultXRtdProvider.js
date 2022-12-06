import { submodule } from '../src/hook.js';
import { config } from '../src/config.js';
import { ajax } from '../src/ajax.js';
import {
  logMessage, logError, mergeDeep, deepSetValue
} from '../src/utils.js';

// const DEFAULT_API_URL = 'https://demand.catapultx.com';
// const DEFAULT_API_URL = 'https://localhost:5001';
const DEFAULT_API_URL = 'https://dev-demand.catapultx.com';

const missingDataError = (description, location, object) => {
  logError(`CatapultX RTD module unable to comeplete because of ${description} missing from the ${location}: `, object)
  throw new Error();
};

/**
 * Init - we will always init because we transmitting data
 * about the website and its content
 * @param {Object} config Module configuration
 * @param {boolean} userConsent
 * @returns true
 */
const init = (config, userConsent) => {
  if (config.params === undefined || config.params?.bidders === null) {
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
  if (!reqBidsConfig?.adUnits?.length || reqBidsConfig?.adUnits?.length < 1) {
    missingDataError('adUnits', 'request object', reqBidsConfig);
  }
  try {
    const { groupId, apiUrl, validAdUnits, bidders } = getDataFromConfig(moduleConfig, reqBidsConfig, callback);
    const requestUrl = `${apiUrl}/api/v1/analyze/video/prebid`;
    getContent(requestUrl, groupId, validAdUnits, bidders)
    .then(contextData => {
      addContextDataToRequests(contextData, reqBidsConfig, bidders)
      logMessage("where content shiloh LAST", reqBidsConfig?.ortb2Fragments?.global, reqBidsConfig?.ortb2Fragments?.bidder)
      callback()
    });
  } catch (error) {
    logError('[cx data module]', error);
    callback();
  }
}

/**
 * Retrieves relevant values from configs provided to RTD adapter
 * @param {Object} moduleConfig Config object passed to the module
 * @param {Object} reqBidsConfig Config object for the bidders; each adapter has its own entry
 * @returns {Object} Extracted configuration parameters for the module
 */
export const getDataFromConfig = (moduleConfig, reqBidsConfig) => {
  // two options
  // 1 make groupid optional so anyone can use our service
  // 2 make it required so we can add group specific modifiers to content object
  const groupId = moduleConfig.params?.groupId;
  if (!groupId) {
    missingDataError('groupId', 'module config', moduleConfig)
  }
  // apiUrl
  const apiUrl = moduleConfig.params?.apiUrl || DEFAULT_API_URL;

  // Bidders
  const moduleBidders = moduleConfig.params?.bidders || [];
  if (!moduleBidders.length) {
    missingDataError('bidders', 'module config', moduleConfig);
  }

  const validAdUnits = adUnits.filter(unit => locateVideoUrl(unit));

  const adUnitBidders = new Set();
  validAdUnits.forEach(unit => unit.bids.forEach(bid => adUnitBidders.add(bid.bidder)));

  const bidders = moduleBidders.filter(bidder => adUnitBidders.has(bidder));
  if (!bidders.length) {
    missingDataError('matching adunit bidders', 'module config bidder array', bidders);
  }

  return { apiUrl, groupId, validAdUnits, bidders };
}


const locateVideoUrl = (unit) => {
  const location = unit?.ortb2Imp?.ext?.data?.videoLocation
  if(!location){
    return false
  } else {
    const videoUrl = "https://d1w0hpjgs8j5kt.cloudfront.net/0a624516707733f07b9358c139789958.mp4"
    
    //this should work but runtime is weird
    // document.querySelector(location)?.querySelector('video')?.src || 
    // document.querySelector('#'+location)?.querySelector('video')?.src || 
    // document.querySelector('.'+location)?.querySelector('video')?.src || 
    // null
    
    if(videoUrl){
      unit.ortb2Imp.ext.data.videoUrl = videoUrl;
      return true
    }
    return false
  }
}

const getContent = async (apiUrl, groupId, validAdUnits, bidders) => {
  return new Promise((resolve, reject) => {
    const contextRequest = {
      groupId: groupId,
      videoUnits: validAdUnits.flatMap(unit => {
        return unit.bids.flatMap(bid => {
          if(bidders.indexOf(bid.bidder) > -1) {
            return {adUnitCode: unit.code, bidder: bid.bidder, videoUrl: unit.ortb2Imp.ext.data.videoUrl}
          }
          return [];
        })
      })
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

// leave for now for comparison purposes
/**
 * Merges the targeting data with the existing config for bidder and updates
 * @param {string} bidder Bidder for which to set config
 * @param {Object} ortb2Updates Updates to be applied to bidder config
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
 * @param {Object} papiResponse Response from Profile API
 * @param {Object} config Module configuration
 * @param {string[]} config.bidders Bidders specified in module's configuration
 */
export const addContextDataToRequests = (contextData, reqBidsConfig, bidders) => {
  const bidderConfigs = config.getBidderConfig();

  for (const bidder of bidders) {
    const bidderContent = contextData.find(x => x.bidder === bidder);
    logMessage("shiloh function content", bidderContent, bidder, contextData)
    const updatedBidderOrtb2 = updateBidderConfig(bidder, bidderContent.videoContent, bidderConfigs);
    logMessage("config updates", updatedBidderOrtb2);
    logMessage("where content shiloh", reqBidsConfig?.ortb2Fragments?.global, reqBidsConfig?.ortb2Fragments?.bidder)
    if (updatedBidderOrtb2) {
      // config.setBidderConfig({
      //   bidders: [bidder],
      //   config: updatedBidderConfig
      // });
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
