# catapultx Real-time Data Submodule

## Overview

```
Module Name: catapultx Rtd Provider
Module Type: Rtd Provider
Maintainer: mannese@catapultx.com
```

## Description

The catapultx RTD module appends contextual segments to the bidding object based on site and video content

### Build
```
gulp build --modules="rtdModule,catapultxRtdProvider,catapultxBidAdapter,..."  
```

> `rtdModule` is a required module to use catapultx RTD module.

### Configuration

Use `setConfig` to instruct Prebid.js to initilize the catapultx RTD module, as specified below. 
This module also requires that the videoUrl from the target player to specify what needs to be analyzed by our AI.


# RTD Module Setup

```
pbjs.setConfig({
    realTimeData: {
        auctionDelay: TIMEOUT,
        dataProviders: [{
            name: 'catapultx',
            waitForIt: true,
            params: {
                groupId: 'ABC123', //required parameter
                bidders: ['catapultx', 'adapter2'],
                apiUrl: 'example.com' //internal for testing purposes only
                timeout: 1000
            }
        }]
    }
});
```

# Adunits integration

```
    var adUnits = [{
        code: 'target-div-01',
        mediaTypes: {
            banner: {
                sizes: [[300, 250]], //example mediatype
            }
        },
        bids: [{
            bidder: "catapultx", //example
            params: {
                testParam: "test"
            }
        }],
        ortb2Imp: {
            ext: {
                data: {
                    videoUrl: "example.com/video.mp4" //required
                }
            }
        }
    }];
```

## Testing 

To view an example of how the catapultx RTD module works :

`gulp serve --modules=rtdModule,catapultxRtdProvider,catapultxBidAdapter`

navigate to:

`http://localhost:9999/integrationExamples/gpt/catapultxRtdProvider_example.html`
