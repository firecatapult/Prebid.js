import { submodule } from '../src/hook.js';
import { ajax } from '../src/ajax.js';
import { logWarn, mergeDeep, logMessage, generateUUID } from '../src/utils.js';
import { loadExternalScript } from '../src/adloader.js';
import * as events from '../src/events.js';
import CONSTANTS from '../src/constants.json';

const DEFAULT_API_URL = 'https://demand.qortex.ai';

events.on(CONSTANTS.EVENTS.BILLABLE_EVENT, (e) => {
  logMessage('BILLABLE EVENT LISTENER', e)
})

let currentSiteContext = null;
const impressionIds = new Set();

/**
 * Init if module configuration is valid
 * @param {Object} config Module configuration
 * @returns {Boolean}
 */
function init (config) {
  if (!config?.params?.groupId?.length > 0) {
    logWarn('Qortex RTD module config does not contain valid groupId parameter. Config params: ' + JSON.stringify(config.params))
    return false;
  }
  if (config?.params?.tagConfig) {
    loadScriptTag(config)
  }
  return true;
}

function loadScriptTag(config) {
  const code = 'qortex';

  addEventListener('qortex-rtd', (e) => {
    const billableEvent = {
      vendor: code,
      billingId: generateUUID(),
      type: e?.detail?.type,
      accountId: config.params.groupId
    }
    switch (e?.detail?.type) {
      case 'qx-impression':
        const {uid} = e.detail;
        if (!uid || impressionIds.has(e.detail.uid)) {
          logWarn(`recieved invalid billable event due to ${!uid ? 'missing': 'duplicate'} uid: qx-impression`)
          return;
        } else {
          logMessage("recieved billable event: qx-impression")
          impressionIds.add(uid)
          billableEvent.transactionId = e.detail.uid;
          break;
        }
      default:
        logWarn(`recieved invalid billable event: ${e.detail.type}`)
        return;
    }
    events.emit(CONSTANTS.EVENTS.BILLABLE_EVENT, billableEvent);
  })
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
    const {apiUrl, bidders, groupId} = moduleConfig.params;
    const requestUrl = `${apiUrl || DEFAULT_API_URL}/api/v1/analyze/${groupId}/prebid`;
    getContext(requestUrl, groupId)
      .then(contextData => {
        setContextData(contextData)
        addContextToRequests(reqBidsConfig, bidders)
        callback();
      })
      .catch((e) => {
        logWarn(e.message);
        callback();
      });
  } else {
    logWarn('No adunits found on request bids configuration: ' + JSON.stringify(reqBidsConfig))
    callback();
  }
}

/**
 * determines whether to send a request to context api and does so if necessary
 * @param {String} requestUrl Qortex context api url
 * @param {String} groupId Qortex publisher groupId
 * @param {Boolean} updated boolean indicating whether or not the video source url has changed since last lookup in runtime
 * @returns {Promise} ortb Content object
 */
export function getContext (requestUrl, groupId) {
  if (!currentSiteContext) {
    logMessage('Requesting new context data');
    return new Promise((resolve, reject) => {
      const contextRequest = {
        groupId: groupId
      }
      const options = {
        contentType: 'application/json'
      }
      const callbacks = {
        success(text, data) {
          const result = data.status === 200 ? JSON.parse(data.response)?.content : null;
          resolve(result);
        },
        error(error) {
          reject(new Error(error));
        }
      }
      ajax(requestUrl, callbacks)
    })
  } else {
    logMessage('Adding Content object from existing context data');
    return new Promise(resolve => resolve(currentSiteContext));
  }
}

/**
 * Updates bidder configs with the response from Qortex context services
 * @param {Object} reqBidsConfig Bid request configuration object
 * @param {string[]} bidders Bidders specified in module's configuration
 */
export function addContextToRequests (reqBidsConfig, bidders) {
  if (currentSiteContext === null) {
    logWarn('No context data recieved at this time');
  } else {
    const fragment = { site: {content: currentSiteContext} }
    if (bidders?.length > 0) {
      bidders.forEach(bidder => mergeDeep(reqBidsConfig.ortb2Fragments.bidder, {[bidder]: fragment}))
    } else if(!bidders) {
      mergeDeep(reqBidsConfig.ortb2Fragments.global, fragment);
    }
  }
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
