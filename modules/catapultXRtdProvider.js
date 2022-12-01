import { submodule } from '../src/hook.js';
import { config } from '../src/config.js';
import { ajax } from '../src/ajax.js';
import {
  logMessage, logError, mergeDeep,
  isNumber, isArray, deepSetValue
} from '../src/utils.js';

//why are all of these functions exported? do they have to be or 
//can we just export the required functions?

//we will use this
export const segtaxes = {
  //read then delete (probably in the docs we already have)
  // https://github.com/InteractiveAdvertisingBureau/openrtb/pull/108
  AUDIENCE: 526,
  CONTENT: 527,
};

// The RTD submodule object to be exported
export const catapultxSubmodule = {
  name: 'catapultxRTDModule',
  init: init,
  getBidRequestData: getBidRequestData
}

/**
 * Init - we will always init because we transmitting data
 * about the website and its content
 * @param {Object} config Module configuration
 * @param {boolean} userConsent
 * @returns true
 */
 const init = (config, userConsent) => {
  return true;
}

/**
 *
 * @param {Object} reqBidsConfigObj Bid request configuration object
 * @param {Function} callback Called on completion
 * @param {Object} moduleConfig Configuration for 1plusX RTD module
 * @param {Object} userConsent
 */
 const getBidRequestData = async (reqBidsConfigObj, callback, moduleConfig, userConsent) => {
  try {
    // Get the required config
    const { customerId, bidders } = extractConfig(moduleConfig, reqBidsConfigObj);
    const apiUrl = `${apiUrl}/api/v1/monetize/resources/prebid/${reqBidsConfigObj.params.groupId}` //discover the best way to include groupId
    const data = await getData(apiUrl);
    //transform data
  } catch (error) {
    logError(LOG_PREFIX, error);
    //seems odd to do the callback in the error block, but we will
    //know more about how we will handle this when we implement on test pages    
    callback();
  }
}

/**
 * Extracts the parameters for 1plusX RTD module from the config object passed at instanciation
 * @param {Object} moduleConfig Config object passed to the module
 * @param {Object} reqBidsConfigObj Config object for the bidders; each adapter has its own entry
 * @returns {Object} Extracted configuration parameters for the module
 */
export const extractConfig = (moduleConfig, reqBidsConfigObj) => {
  // CustomerId
  const groupId = moduleConfig.params?.groupId;
  if (!groupId) {
    throw new Error('Missing parameter groupId in moduleConfig');
  }
  // Timeout
  const tempTimeout = moduleConfig.params?.timeout;
  //this can be optimized or removed
  const timeout = isNumber(tempTimeout) && tempTimeout > 300 ? tempTimeout : 1000;

  // Bidders
  const biddersTemp = moduleConfig.params?.bidders;
  if (!isArray(biddersTemp) || !biddersTemp.length) {
    throw new Error('Missing parameter bidders in moduleConfig');
  }

  const adUnitBidders = reqBidsConfigObj.adUnits
    .flatMap(({ bids }) => bids.map(({ bidder }) => bidder))
    .filter((e, i, a) => a.indexOf(e) === i);
    //we can probably remove isArray
  if (!isArray(adUnitBidders) || !adUnitBidders.length) {
    //this error could be more descriptive
    throw new Error('Missing parameter bidders in bidRequestConfig');
  }

  const bidders = biddersTemp.filter(bidder => adUnitBidders.includes(bidder));
  if (!bidders.length) {
    throw new Error('No bidRequestConfig bidder found in moduleConfig bidders');
  }

  return { customerId, timeout, bidders };
}

const getData = (apiUrl) => {
  //do thing with data apiUrl
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
export const setTargetingDataToConfig = (papiResponse, { bidders }) => {
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

// Register the catapultxSubmodule as submodule of realTimeData
submodule('realTimeData', catapultxSubmodule);
