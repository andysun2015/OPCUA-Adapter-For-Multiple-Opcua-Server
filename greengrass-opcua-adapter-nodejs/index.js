'use strict';

require('requirish')._(module);
const Subscriber = require('subscriber');
const opcua = require('node-opcua');
const IotData = require('aws-greengrass-core-sdk').IotData;

const device = new IotData();

Subscriber.setOPCUA(opcua);
Subscriber.setIoTDevice(device);
const OPCUASubscriber = Subscriber.OPCUASubscriber;

var jsonFile = require('jsonfile');
var fileName = 'server_config.json';
var folder = 'config';

var opcua_url = "opc.tcp://localhost";
var configSet = {
    server: {
        name: 'server',
        url: opcua_url,
    },
    subscriptions: [
        {
        name: 'MyPumpSpeed',
        nodeId: 'ns=1;s=PumpSpeed',
        },
    ],
};


const clientOptions = {
    keepSessionAlive: true,
    connectionStrategy: {
        maxRetry: 100000,
        initialDelay: 2000,
        maxDelay: 10 * 1000,
    },
};


function checkPortRange(value)
{
    if (value <0 || value > 65535) {
        return false;
    } else {
        return true;
    }
}

function isEmptyOrWhitespace(value)
{
    if (!value) {
        console.log("input is empty");
        return true;
    }

    if (!value.trim()) {
        console.log("input is whitespace");
        return true;
    }

    return false;

}

function isPortValid(value)
{
    if (!Number.isInteger(value)) {
        console.log("Port is not a number");
        return false;
    }

    if (!checkPortRange(value)) {
        console.log("invalid port range");
        return false;
    }

    return true;
}

function isServerNameValid(value)
{
    if (isEmptyOrWhitespace(value)) {
        console.log("Server is empty or whitespace");
        return false;
    }

    return true;
}

jsonFile.readFile(folder+'/'+fileName, function(err, jsonData) {
    if (err) throw err;
    for (var i = 0; i <jsonData.length; ++i) {

        if (!isPortValid(jsonData[i].port)) {
            console.log("invalid port");
            continue;
        }

        if (!isServerNameValid(jsonData[i].server_id)) {
            console.log("invalid server id");
            continue;
        }

        console.log("server id: " + jsonData[i].server_id);
        console.log("port: " + jsonData[i].port);

        configSet.server.url = opcua_url +':'+jsonData[i].port;
        configSet.server.name = jsonData[i].server_id;
        var client = new opcua.OPCUAClient(clientOptions);
        var subscriber = new OPCUASubscriber(client, configSet.server, configSet.subscriptions);
        subscriber.connect();
    }
});


exports.handler = (event, context) => {
    console.log('Not configured to be called');
};
