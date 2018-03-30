var AWS = require('aws-sdk');
var https = require('https');
require('https').debug = true;

var url = require('url');

var lambda = new AWS.Lambda();
var sns = new AWS.SNS();

const hookUrl = process.env.HOOK_URL;

function postMessage(message, callback) {
    const data = JSON.stringify(message);
    const options = url.parse(hookUrl);
    
    options.method = 'POST';
    options.headers = {
        'Content-Length': Buffer.byteLength(data),
    };
    options.body = data;
    options.json = true;
    
    const postReq = https.request(options, (res) => {
        const chunks = [];
        res.setEncoding('utf8');
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
            if (callback) {
                callback({
                    body: chunks.join(''),
                    statusCode: res.statusCode,
                    statusMessage: res.statusMessage,
                });
            }
        });
        return res;
    });
    postReq.write(data);
    postReq.end();
}

exports.handler = (event, context, callback) => {
  
    var jsonEvent = JSON.parse(event.Records[0].Sns.Message);
    

    var severity = 'warning';
    

    if (jsonEvent.detail.severity >= 7.0) {
        severity = 'danger';
    }

    if(jsonEvent.detail.severity > 2.0)
    {

        var instanceId, tags
        if (Object.is(jsonEvent.detail.resource.instanceDetails, undefined) == false) {
            instanceId = jsonEvent.detail.resource.instanceDetails.instanceId;
            tags = JSON.stringify(jsonEvent.detail.resource.instanceDetails.tags, null, ' ');
        }
        
        const slackMessage = {
            text: jsonEvent.detail.title,
            attachments: [
                {
    	            fallback: jsonEvent.detail.title,
    	            pretext: `account: ${jsonEvent.account} region: ${jsonEvent.region}`,
    	            color: severity,
    	            fields: [
                        {
    	                    title: 'description',
    	                    value: jsonEvent.detail.description,
    	                    short: false
                        },	    
    	                {
    	                    title: 'instance',
    	                    value: instanceId,
    	                    short: false
    	                },
                        {
    	                    title: 'tags',
    	                    value: tags,
    	                    short: false
    	                },
    	                {
    	                    title: 'type',
    	                    value: jsonEvent.detail.type,
    	                    short: true
    	                }
                    ]
                }
            ]
        };
    
        postMessage(slackMessage, (response) => {
            if (response.statusCode < 400) {
                console.info('Message posted successfully');
            } else if (response.statusCode < 500) {
                console.error(`Error posting message to Slack API: ${response.statusCode} - ${response.statusMessage}`);
            } else {
                // Let Lambda retry
                callback(`Server error when processing message: ${response.statusCode} - ${response.statusMessage}`);
            }
        });
       }
       callback();
};
