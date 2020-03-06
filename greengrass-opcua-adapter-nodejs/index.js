'use strict';

require('requirish')._(module);
const Subscriber = require('subscriber');
const opcua = require('node-opcua');
const IotData = require('aws-greengrass-core-sdk').IotData;

const device = new IotData();

Subscriber.setOPCUA(opcua);
Subscriber.setIoTDevice(device);

const OPCUASubscriber = Subscriber.OPCUASubscriber;

const ConfigAgent = require('./config_agent');

var OPCUASubscriberSet = [];
var OPCUAClientSet = [];

function dumpServerInfo(obj)
{
    obj.configSet.forEach(function(item, index, object) {
        console.log("item.server.url:" + item.server.url);
        console.log("item.server.name:" + item.server.name);
        console.log("item.connection:" + item.connection);
    });
}

function clearArray(obj) {
  while (obj.length) {
    obj.pop();
  }
}

function connect_server(serverObj,clientObj)
{
    var i = 0;
    for (i = 0; i < serverObj.configSet.length; i ++) {
        if (!serverObj.configSet[i].connection) {
            var client = new opcua.OPCUAClient(clientObj);
            var subscriber = new OPCUASubscriber(client, serverObj.configSet[i].server, serverObj.configSet[i].subscriptions);
            OPCUASubscriberSet.push(subscriber);
            OPCUAClientSet.push(client);
            subscriber.connect();
            serverObj.configSet[i].connection = true;
        }
    }
}


ConfigAgent.config_init(ConfigAgent.ServerConfigSet, ConfigAgent.clientOptions, ()=> {
    connect_server(ConfigAgent.ServerConfigSet, ConfigAgent.clientOptions);
    console.log("+++++++++++++++ dump ConfigAgent.ServerConfigSet +++++++++++++++");
    dumpServerInfo(ConfigAgent.ServerConfigSet);
    ConfigAgent.check_file_loop(()=>{
        //disconnect subscriber
        // 1. disconnect subscribe which not exist or need modification
        ConfigAgent.config_init(ConfigAgent.ReConfigServerSert, ConfigAgent.clientOptions, ()=>{            
            if (ConfigAgent.ReConfigServerSert.configSet.length > 0) {
                for (var k = 0; k < OPCUASubscriberSet.length; k ++) {
                    var item = OPCUASubscriberSet[k];
                    var ExistFlag = false;
                    //check server/url information between subscriber and new config
                    var server = item.getServerConfig();
                    var subscription = item.getNodeConfig();
                    for (var i = 0; i < ConfigAgent.ReConfigServerSert.configSet.length; i ++) {
                        if (server.name === ConfigAgent.ReConfigServerSert.configSet[i].server.name &&
                            server.url === ConfigAgent.ReConfigServerSert.configSet[i].server.url) {
                            //if name and url are identical, check node information
                            var reconfigSubscription = ConfigAgent.ReConfigServerSert.configSet[i].subscriptions;
                            if (subscription.length === reconfigSubscription.length &&
                                subscription.every(function(sub, j) {
                                    var exist = false;
                                    reconfigSubscription.forEach( (reconfigSub)=>{
                                        //compare the content of subscription from new modification and connected.
                                        if (JSON.stringify(reconfigSub) === JSON.stringify(sub)) {
                                            exist = true;
                                            return;
                                        }
                                    })
                                    console.log(j+":exist:" + exist);
                                    return exist;
                                })) {
                                    ConfigAgent.ReConfigServerSert.configSet[i].connection = true;
                                    ExistFlag =true;
                                } else {
                                    //same name, different node
                                    ConfigAgent.ReConfigServerSert.configSet[i].connection = false;
                                    ExistFlag = false;
                                }
                            //same name, break anyway
                            break;
                        } 
                    }
                    console.log("ExistFlag:"+ExistFlag);
                    if (!ExistFlag) {
                        //disconnect subsrcibe
                        item.disconnect();
                        // 2. remove not exist subscribe
                        OPCUASubscriberSet.splice(k,1);
                        k -=1;
                    }
                }
                // 3. connect to modified server
                connect_server(ConfigAgent.ReConfigServerSert, ConfigAgent.clientOptions);

                ConfigAgent.ServerConfigSet = ConfigAgent.ReConfigServerSert;
                console.log("+++++++++++++++ dump ConfigAgent.ReConfigServerSert +++++++++++++++");
                dumpServerInfo(ConfigAgent.ReConfigServerSert);
                clearArray(ConfigAgent.ReConfigServerSert.configSet);
            } else {
                console.log("No config from server_config.json");
            }
        });
    });
});

exports.handler = (event, context) => {
    console.log('Not configured to be called');
};
