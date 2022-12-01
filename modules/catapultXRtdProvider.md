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

This module is configured as part of the `realTimeData.dataProviders`

```javascript
var TIMEOUT = 1000;
pbjs.setConfig({
    realTimeData: {
        auctionDelay: TIMEOUT,
        dataProviders: [{
            name: 'catapultx',
            waitForIt: true,
            params: {
                groupId: 'ABC123', //required parameter
                bidders: ['catapultx', 'adapter2'],
                timeout: TIMEOUT
            }
        }]
    }
});

```
## Testing 

To view an example of how the catapultx RTD module works :

`gulp serve --modules=rtdModule,catapultxRtdProvider,catapultxBidAdapter`

navigate to:

`http://localhost:9999/integrationExamples/gpt/catapultxRtdProvider_example.html`
