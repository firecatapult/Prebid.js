# qortex Real-time Data Submodule

## Overview

```
Module Name: qortex Rtd Provider
Module Type: Rtd Provider
Maintainer: mannese@qortex.ai
```

## Description

The qortex RTD module appends contextual segments to the bidding object based on video content on a page. This module will attempt to find a video source url from the video container provided in its configuration and send it to the qortex context API. 

This will return a [Content object](https://www.iab.com/wp-content/uploads/2016/03/OpenRTB-API-Specification-Version-2-5-FINAL.pdf#page=26). The module will then merge that object into the appropriate bidders' `ortb2.site.content`, which can be used by prebid adapters that use first party `site.content` data.

## Build
```
gulp build --modules="rtdModule,qortexRtdProvider,qortexBidAdapter,..."  
```

> `rtdModule` is a required module to use qortex RTD module.

## Configuration

Please refer to [Prebid Documentation](https://docs.prebid.org/dev-docs/publisher-api-reference/setConfig.html#setConfig-realTimeData) on RTD module configuration for details on required and optional parameters of `realTimeData`

When configuring qortex as a data provider, refer to the template below to add the necessary information to ensure the proper connection is made.  

### RTD Module Setup

```javascript
pbjs.setConfig({
    realTimeData: {
        auctionDelay: 1000,
        dataProviders: [{
            name: 'qortex',
            waitForIt: true,
            params: {
                groupId: 'ABC123', //required
                videoContainer: 'my-video-container', //required
                bidders: ['qortex', 'adapter2'], //optional
                tagConfig: { // optional, please reach out to your account manager for configuration reccommendation
                    videoContainer: 'string',
                    htmlContainer: 'string',
                    attachToTop: 'string',
                    esm6Mod: 'string',
                    continuousLoad: 'string'
                }
            }
        }]
    }
});
```

### Paramter Details

#### `groupId` - Required
- The qortex groupId linked to the publisher, this is required to make a request using this adapter

#### `videoContainer` - Reqired
- The name of the container for the video you would like our API to get contextual data from

- Can either be the `class` or the `id` of the HTML element. 

#### `bidders` - optional
- If this parameter is included, it must be an array of the strings that match the bidder code of the prebid adapters you would like this module to impact. `ortb2.site.content` will be updated *only* for adapters in this array

- If this parameter is omitted, the RTD module will default to updating  `ortb2.site.content` on *all* bid adapters being used on the page

#### `tagConfig` - optional
- This parameter is an object containing the config settings to initialize the qortex integration on your page. A preconfigured object for this step will be provided to you by the qortex team.

- If this parameter is omitted, the RTD module will continue without initializing qortex onto your page. It can still be set up through a script tag in the header of the page.