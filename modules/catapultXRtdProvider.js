import { submodule } from '../src/hook.js';
import { config } from '../src/config.js';
import { ajax } from '../src/ajax.js';
import {
  logMessage, logError, mergeDeep,
  isNumber, isArray, deepSetValue
} from '../src/utils.js';
import { reject } from 'lodash';

// const DEFAULT_API_URL = 'https://demand.catapultx.com';
const DEFAULT_API_URL = 'https://localhost:5001';

const missingDataError = (description, location, object) => {
  logError(`CatapultX RTD module unable to comeplete because of ${description} missing from the ${location}: `,object)
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
  if(config.params === undefined || config.params?.bidders === null) {
    return false;
  }
  return true;
}

/**
 *
 * @param {Object} reqBidsConfig Bid request configuration object
 * @param {Function} callback Called on completion
 * @param {Object} moduleConfig Configuration for 1plusX RTD module
 * @param {Object} userConsent
 */
 const getBidRequestData = async (reqBidsConfig, callback, moduleConfig, userConsent) => {
  if (!reqBidsConfig?.adUnits?.length ||reqBidsConfig?.adUnits?.length < 1){
    missingDataError("adUnits", "request object", reqBidsConfig);
  }
  try {
    const { groupId, apiUrl, validAdUnits, bidders } = getDataFromConfig(moduleConfig, reqBidsConfig, callback);
    const requestUrl = `${apiUrl}/api/v1/analyze/video/prebid`;
    getContent(requestUrl, groupId, validAdUnits).then(data => logMessage("shiloh data", data));
    //transform data
  } catch (error) {
    logError("[cx data module]", error); 
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
  //two options
  //1 make groupid optional so anyone can use our service
  //2 make it required so we can add group specific modifiers to content object
  const groupId = moduleConfig.params?.groupId;
  if (!groupId) {
    missingDataError("groupId", "module config", moduleConfig)
  }
  //apiUrl
  const apiUrl = moduleConfig.params?.apiUrl || DEFAULT_API_URL;

  // Bidders
  const moduleBidders = moduleConfig.params?.bidders || [];
  if (!moduleBidders.length) {
    missingDataError("bidders", "module config", moduleConfig);
  }

  const validAdUnits = getVideoAdUnits(reqBidsConfig.adUnits);

  const adUnitBidders = new Set();
  validAdUnits.forEach(unit => unit.bids.forEach(bid => adUnitBidders.add(bid.bidder)));

  const bidders = moduleBidders.filter(bidder => adUnitBidders.has(bidder));
  if (!bidders.length) {
    missingDataError("matching adunit bidders", "module config bidder array", bidders);
  }

  return { apiUrl, groupId, validAdUnits, bidders };
}


//returns an array that have the data necessary to analyze
const getVideoAdUnits = (adUnits) => {
  //this is not sanitized
  return adUnits.filter(unit => unit?.ortb2Imp?.ext?.data?.videoUrl.length > 0);
}

const getContent = async (apiUrl, groupId, validAdUnits) => {
  return new Promise((resolve, reject) => {
    const contextRequest = {
      groupId: groupId,
      videoUnits: validAdUnits.map(unit => {
        return {adUnitCode: unit.code, videoUrl: unit.ortb2Imp.ext.data.videoUrl}
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

//we will probably want to have this for support purposes
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

//leave for now for comparison purposes
/**
 * Prepares the update for the ORTB2 object
 * @param {Object} targetingData Targeting data fetched from Profile API
 * @param {string[]} segments Represents the audience segments of the user
 * @param {string[]} topics Represents the topics of the page
 * @returns {Object} Object describing the updates to make on bidder configs
 */
export const buildOrtb2Updates = ({ segments = [], topics = [] }, bidder) => {
  // Currently appnexus bidAdapter doesn't support topics in `site.content.data.segment`
  // Therefore, writing them in `site.keywords` until it's supported
  // Other bidAdapters do fine with `site.content.data.segment`
  const writeToLegacySiteKeywords = LEGACY_SITE_KEYWORDS_BIDDERS.includes(bidder);
  if (writeToLegacySiteKeywords) {
    const site = {
      keywords: topics.join(',')
    };
    return { site };
  }

  const userData = {
    name: ORTB2_NAME,
    segment: segments.map((segmentId) => ({ id: segmentId }))
  };
  const siteContentData = {
    name: ORTB2_NAME,
    segment: topics.map((topicId) => ({ id: topicId })),
    ext: { segtax: segtaxes.CONTENT }
  }
  return { userData, siteContentData };
}

//leave for now for comparison purposes
/**
 * Merges the targeting data with the existing config for bidder and updates
 * @param {string} bidder Bidder for which to set config
 * @param {Object} ortb2Updates Updates to be applied to bidder config
 * @param {Object} bidderConfigs All current bidder configs
 * @returns {Object} Updated bidder config
 */
export const updateBidderConfig = (bidder, ortb2Updates, bidderConfigs) => {
  const { site, siteContentData, userData } = ortb2Updates;
  const bidderConfigCopy = mergeDeep({}, bidderConfigs[bidder]);

  if (site) {
    // Legacy : cf. comment on buildOrtb2Updates first lines
    const currentSite = bidderConfigCopy.ortb2?.site;
    const updatedSite = mergeDeep(currentSite, site);
    deepSetValue(bidderConfigCopy, 'ortb2.site', updatedSite);
  }

  if (siteContentData) {
    const siteDataPath = 'ortb2.site.content.data';
    const currentSiteContentData = deepAccess(bidderConfigCopy, siteDataPath) || [];
    const updatedSiteContentData = [
      ...currentSiteContentData.filter(({ name }) => name != siteContentData.name),
      siteContentData
    ];
    deepSetValue(bidderConfigCopy, siteDataPath, updatedSiteContentData);
  }

  if (userData) {
    const userDataPath = 'ortb2.user.data';
    const currentUserData = deepAccess(bidderConfigCopy, userDataPath) || [];
    const updatedUserData = [
      ...currentUserData.filter(({ name }) => name != userData.name),
      userData
    ];
    deepSetValue(bidderConfigCopy, userDataPath, updatedUserData);
  }

  return bidderConfigCopy;
};

/**
 * Updates bidder configs with the targeting data retreived from Profile API
 * @param {Object} papiResponse Response from Profile API
 * @param {Object} config Module configuration
 * @param {string[]} config.bidders Bidders specified in module's configuration
 */
export const addContextDataToRequests = (papiResponse, { bidders }) => {
  const bidderConfigs = config.getBidderConfig();
  const { s: segments, t: topics } = papiResponse;

  for (const bidder of bidders) {
    const ortb2Updates = buildOrtb2Updates({ segments, topics }, bidder);
    const updatedBidderConfig = updateBidderConfig(bidder, ortb2Updates, bidderConfigs);
    if (updatedBidderConfig) {
      config.setBidderConfig({
        bidders: [bidder],
        config: updatedBidderConfig
      });
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
