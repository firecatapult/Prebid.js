import { submodule } from '../src/hook.js';
import { config } from '../src/config.js';
import { ajax } from '../src/ajax.js';
import {
  logError, mergeDeep, deepSetValue
} from '../src/utils.js';

// const DEFAULT_API_URL = 'https://demand.catapultx.com';
// const DEFAULT_API_URL = 'https://localhost:5001';
const DEFAULT_API_URL = 'https://dev-demand.catapultx.com';

const initializedTime = (new Date()).getTime();
const moduleConfigData = {
  groupId: null,
  videoContainer: null,
  apiUrl: null,
  validAdUnits: null,
  moduleBidders: null,
  videoSrc: null
}
let extendedSiteContent = null;

const missingDataError = (description, location, object) => {
  logError(`CatapultX RTD module unable to complete because of ${description} missing from the ${location}: `, object)
  throw new Error();
};

/**
 * Init - if there are bidders we will at least init
 * @param {Object} config Module configuration
 * @param {boolean} userConsent
 * @returns true
 */
const init = (config, userConsent) => {
  console.log('Init CX Data Module: ', config);
  if (config.params === undefined || config.params?.bidders === null) {
    return false;
  }
  getDataFromConfig(config);
  if(typeof moduleConfigData.videoSrc === 'undefined' || moduleConfigData.videoSrc === null && moduleConfigData.videoContainer !== null){
    locateVideoSrc(moduleConfigData.videoContainer);
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
  if(extendedSiteContent !== null){
    addContextDataToRequests(reqBidsConfig);
  }else{
    console.log('extendedSiteContent not available to add to bidders');
  }
}

/**
 * Retrieves relevant values from configs provided to RTD adapter
 * @param {Object} moduleConfig Config object passed to the Module
 */
export const getDataFromConfig = (moduleConfig) => {
  // two options
  // 1 make groupid optional so anyone can use our service
  // 2 make it required so we can add group specific modifiers to content object
  const groupId = moduleConfig.params?.groupId ?? null;
  moduleConfigData.groupId = groupId;
  if (!groupId) {
    missingDataError('groupId', 'module config', moduleConfig)
  }

  const videoContainer = moduleConfig.params?.videoContainer ?? null;
  moduleConfigData.videoContainer = videoContainer;
  if (!videoContainer) {
    missingDataError('videoContainer', 'module config', moduleConfig)
  }
  
  moduleConfigData.videoSrc = moduleConfig.params?.videoSrc;
  
  const apiUrl = moduleConfig.params?.apiUrl || DEFAULT_API_URL;
  moduleConfigData.apiUrl = apiUrl;

  const moduleBidders = moduleConfig.params?.bidders || [];
  moduleConfigData.moduleBidders = moduleBidders;
  if (!moduleBidders.length) {
    missingDataError('bidders', 'module config', moduleConfig);
  }
}


const locateVideoSrc = (elm) => {
  console.log('Looking for video source on element: ' + elm);
  let videoElement = document.querySelector(`#${elm},.${elm}`)?.querySelector('video');
  let videoSource = (typeof videoElement !== 'undefined' && videoElement !== null)?videoElement.src || videoElement.querySelector('source').src:null;
  if(videoSource !== null && videoSource !== ''){
    console.log(`Video source '${videoSource}' found on node ${elm}`);
    moduleConfigData.videoSrc = videoSource;

    if(moduleConfigData.apiUrl !== null){
      getVideoContent().then(contextData => {
        extendedSiteContent = contextData;
        console.log('extendedSiteContent retrieved', extendedSiteContent);
      });
    }

    return true;
  }else{
    console.log(`Video source not found (${videoElement})`);
    if((new Date()).getTime() - initializedTime < 1000){
      setTimeout(()=>{locateVideoSrc(elm)}, 250);
    }
    return false
  }
}

const getVideoContent = async() =>{
  const requestUrl = `${moduleConfigData.apiUrl}/api/v1/analyze/video/prebid`;
  return new Promise((resolve, reject) => {
    const contextRequest = {
      groupId: moduleConfigData.groupId,
      //Not sure if we need adUnitCode and bidder here - Is it used on the monetize side?
      videoUnits: [{adUnitCode: 'unitCode', bidder: 'catapultX', videoUrl: moduleConfigData.videoSource}]
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
    ajax(requestUrl, callbacks, JSON.stringify(contextRequest), options)
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
 * Updates bidder configs with the targeting data retreived from Profile API
 * @param {Object} reqBidsConfig request bids configuration
 */
export const addContextDataToRequests = (reqBidsConfig) => {

  reqBidsConfig?.adUnits?.forEach?.(unit =>{
    unit?.bids?.forEach?.(bid =>{
      if(moduleConfigData.moduleBidders.includes(bid?.bidder)){
        const updatedBidderOrtb2 = updateBidderConfig(bid.bidder, extendedSiteContent[0].videoContent, reqBidsConfig);
        if (updatedBidderOrtb2) {
          mergeDeep(reqBidsConfig.ortb2Fragments.bidder, {[bid.bidder]: updatedBidderOrtb2.ortb2})
        }
      }
    })
  })

  console.log('Finalized bid config after extended site content: ', reqBidsConfig);

}

/**
 * Merges the targeting data with the existing config for bidder and updates
 * @param {string} bidderName Bidder for which to set config
 * @param {Object} bidderContent selected content object to be added
 * @param {Object} bidderConfigs All current bidder configs
 * @returns {Object} Updated bidder config
 */
export const updateBidderConfig = (bidderName, bidderContent, bidderConfigs) => {
  const bidderConfigCopy = mergeDeep({}, bidderConfigs[bidderName]);
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

// The RTD submodule object to be exported
export const catapultxSubmodule = {
  name: 'catapultx',
  init: init,
  getBidRequestData: getBidRequestData
}

// Register the catapultxSubmodule as submodule of realTimeData
submodule('realTimeData', catapultxSubmodule);
