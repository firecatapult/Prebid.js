# Overview

```
Module Name: qortex Bidder Adapter
Module Type: Bidder Adapter
Maintainer: mannese@qortex.ai
```

# Description

Module that connects to qortex monetize api
Currently supports Banner format
This supports: GDPR ConsentManagement module, US Privacy ConsentManagement module, DNT, coppa

# Test Parameters

```
    var adUnits = [{
        code: 'target-div-01',
        mediaTypes: {
            banner: {
                sizes: [[300, 250]], // banner size
            }
        },
        bids: [{
            bidder: "qortex",
            params: {
                groupId: 'ABC123', //required parameter
                qxData: {}, //internal for enriched bidding from qortex onstream integration
                apiUrl: 'cpm.api.com', //internal for testing only
            }
        }]
    }];
```
