'use strict';

require('requirish')._(module);
const fs = require('fs');
var jsonFile = require('jsonfile');
var ServerConfigfileName = 'server_config.json';
var ClientConfigfileName = 'client_config.json';
var folder = 'config';
//var folder = '/etc/greengrass/opcua-adapter/config';
var ServerConfigSet = {
    LastModifiedtime:"",
    configSet:[]
};

var ReConfigServerSert = {
    LastModifiedtime:"",
    configSet:[]
};

var ServerFileLastModifyTime;

var clientOptions = {
    keepSessionAlive: true,
    connectionStrategy: {
        maxRetry: 100000,
        initialDelay: 2000,
        maxDelay: 10 * 1000,
    },
    checkServerConfigInterval: 1000
};

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

function isServerNameValid(value)
{
    if (isEmptyOrWhitespace(value)) {
        console.log("Server is empty or whitespace");
        return false;
    }

    return true;
}

function config_init(serverConfig, clientConfig, callback)
{
    jsonFile.readFile(folder+'/'+ClientConfigfileName, function(err, jsonData) {
        if (err) throw err;
        for (var i = 0; i <jsonData.length; ++i) {

            if (isEmptyOrWhitespace(jsonData[i].keepSessionAlive)) {
                console.log("jsonData[i].keepSessionAlive is empty or whitespace");
                return false;
            }

            if (!Number.isInteger(jsonData[i].connectionStrategy.maxRetry)) {
                console.log("jsonData[i].connectionStrategy.maxRetry is not a number");
                return false;
            }

            if (!Number.isInteger(jsonData[i].connectionStrategy.initialDelay)) {
                console.log("invalid .connectionStrategy.initialDelay is not a number");
                return false;
            }

            if (!Number.isInteger(jsonData[i].connectionStrategy.maxDelay)) {
                console.log("connectionStrategy.maxDelay is not a number");
                return false;
            }

            if (!Number.isInteger(jsonData[i].checkServerConfigInterval)) {
                console.log("connectionStrategy.maxDelay is not a number");
                return false;
            }

            clientConfig.keepSessionAlive = jsonData[i].keepSessionAlive;
            clientConfig.connectionStrategy.maxRetry = jsonData[i].connectionStrategy.maxRetry;
            clientConfig.connectionStrategy.initialDelay = jsonData[i].connectionStrategy.initialDelay;
            clientConfig.connectionStrategy.maxDelay = jsonData[i].connectionStrategy.maxDelay;
            clientConfig.checkServerConfigInterval = jsonData[i].checkServerConfigInterval;

            console.log("jsonData[i].keepSessionAlive: " + jsonData[i].keepSessionAlive);
            console.log("jsonData[i].connectionStrategy.maxRetry: " + jsonData[i].connectionStrategy.maxRetry);
            console.log("jsonData[i].connectionStrategy.initialDelay: " + jsonData[i].connectionStrategy.initialDelay);
            console.log("jsonData[i].connectionStrategy.maxDelay: " + jsonData[i].connectionStrategy.maxDelay);
            console.log("jsonData[i].checkServerConfigInterval: " + jsonData[i].checkServerConfigInterval);
        }
    });

    jsonFile.readFile(folder+'/'+ServerConfigfileName, function(err, jsonData) {
        if (err) throw err;
        var stats = fs.statSync(folder+'/'+ServerConfigfileName);
        ServerFileLastModifyTime = stats.mtime;
        for (var i = 0; i <jsonData.length; ++i) {
            if (!isServerNameValid(jsonData[i].EndpointName)) {
                console.log("invalid EndpointName");
                continue;
            }

            if (!isServerNameValid(jsonData[i].EndpointUrl)) {
                console.log("invalid EndpointUrl");
                continue;
            }

            if (jsonData[i].OpcNodes.length <= 0) {
                console.log("No OpcNodes!");
                continue;
            }
            var configSet = {
                server: {
                    name: "",
                    url: "",
                },
                subscriptions: [

                ],
                connection:false
            };
            console.log("EndpointName: " + jsonData[i].EndpointName);
            console.log("EndpointUrl: " + jsonData[i].EndpointUrl);
            for (var j = 0; j < jsonData[i].OpcNodes.length; j++ ) {
                configSet.subscriptions.push(jsonData[i].OpcNodes[j]);
                console.log("configSet.subscriptions.nodeid: " + configSet.subscriptions[j].nodeId);
                console.log("configSet.subscriptions.name: " + configSet.subscriptions[j].name);
            }
            console.log("configSet.subscriptions node length:" + configSet.subscriptions.length);
            configSet.server.url = jsonData[i].EndpointUrl;
            configSet.server.name = jsonData[i].EndpointName;
            serverConfig.configSet.push(configSet);
            serverConfig.LastModifiedtime =ServerFileLastModifyTime;
        }
        callback();
    });
}


var timeout = 2000;

function datesEqual(a, b) {
    return !(a > b || b > a);
}

function check_file_loop(callback)
{
    var obj = setInterval(()=>{
            clearInterval(obj);
            var server_file_change = false;
            //check server file config file
            var stats = fs.statSync(folder+'/'+ServerConfigfileName);
            var mtime = stats.mtime;
            console.log(mtime);
            //File modified due to different date
            if (!datesEqual(mtime, ServerConfigSet.LastModifiedtime)) {
                ServerConfigSet.LastModifiedtime = mtime;
                callback();
            }
            timeout = clientOptions.checkServerConfigInterval;
            check_file_loop(callback);
        }, timeout);
}

module.exports.config_init = config_init;
module.exports.ServerConfigSet = ServerConfigSet;
module.exports.ReConfigServerSert = ReConfigServerSert;
module.exports.clientOptions = clientOptions;
module.exports.check_file_loop = check_file_loop;

