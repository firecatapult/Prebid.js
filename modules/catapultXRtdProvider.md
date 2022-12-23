# catapultx Real-time Data Submodule

## Overview

```
Module Name: catapultx Rtd Provider
Module Type: Rtd Provider
Maintainer: mannese@catapultx.com
```

## Description

The catapultx RTD module appends contextual segments to the bidding object based on video content on a page. This module will attempt to find a video source url from the video container provided in its configuration and send it to the catapultx context API. 

This will return a [Content object](https://www.iab.com/wp-content/uploads/2016/03/OpenRTB-API-Specification-Version-2-5-FINAL.pdf#page=26). The module will then merge that object into the appropriate bidders' `ortb2.site.content`, which can be used by prebid adapters that use first party `site.content` data.

## Build
```
gulp build --modules="rtdModule,catapultxRtdProvider,catapultxBidAdapter,..."  
```

> `rtdModule` is a required module to use catapultx RTD module.

## Configuration

Please refer to [Prebid Documentation](https://docs.prebid.org/dev-docs/publisher-api-reference/setConfig.html#setConfig-realTimeData) on RTD module configuration for details on required and optional parameters of `realTimeData`

When configuring catapultx as a data provider, refer to the template below to add the necessary information to ensure the proper connection is made.  

### RTD Module Setup

```javascript
pbjs.setConfig({
    realTimeData: {
        auctionDelay: 1000,
        dataProviders: [{
            name: 'catapultx',
            waitForIt: true,
            params: {
                groupId: 'ABC123', //required parameter
                videoContainer: 'my-video-container', //required
                bidders: ['catapultx', 'adapter2'], //optional
            }
        }]
    }
});
```

### Paramter Details

#### `groupId` - Required
- The CatapultX groupId linked to the publisher, this is required to make a request using this adapter

#### `videoContainer` - Reqired
- The name of the container for the video you would like our API to get contextual data from

- Can either be the `class` or the `id` of the HTML element. 

#### `bidders` - optional
- If this parameter is included, it must be an array of the strings that match the bidder code of the prebid adapters you would like this module to impact. `ortb2.site.content` will be updated *only* for adapters in this array

- If this parameter is omitted, the RTD module will default to updating  `ortb2.site.content` on *all* bid adapters being used on the page