# Use Greengrass OPC\-UA to Communicate with Multiple Industrial Equipment<a name="opcua"></a>

Greengrass supports OPC\-UA, an information exchange standard for industrial communication\. OPC\-UA allows you to ingest and process messages from industrial equipment and deliver them to devices in your Greengrass group or to the cloud based on rules you define\.

The Greengrass implementation of OPC\-UA supports certificate\-based authentication\. It is based on an open source implementation, and is fully customizable\. You can also bring your own implementation of OPC\-UA, and implement your own support for other custom, legacy, and proprietary messaging protocols\.

In this section we will cover the following steps: 
+ Connect to an existing multiple OPC\-UA servers\.
+ Monitor multiple existing OPC\-UA nodes within that server\.
+ Get called back when the monitored node's value changes\.


## Architectural Overview<a name="opcua-architecture"></a>

Greengrass implements OPC\-UA as a Lambda function in NodeJS\. Since Lambda functions running on Greengrass cores have access to network resources, you can create Lambda functions that proxy information from your existing OPC\-UA servers over TCP to other functions or services in your Greengrass group\.

Under this architecture, we provide the follling additional information for customer to access:
+ publishednodes\.json, used to configured how many OPC-UA nodes in dedicated OPC-UA server need to be monitored\.
+ cert_config\.json, used to configure the path of server certificates\.
+ client_config\.json, used to configure some client options and time interval to check publishednodes.json modification\.
+ system_status.txt, used to check if the system is alive or not\.

![\[Greengrass OPCUA Architecture.\]](./greengrass-opcua-adapter-nodejs/pics/OPCUA_arch.png)

You can configure Greengrass to have a long\-lived connection to your OPC\-UA server\(s\), and, using OPC\-UA Subscriptions, you can have your OPCUA\_Adapter Lambda function monitor changes to pre\-defined nodes\. Any change to those nodes triggers a Publish event from the OPC\-UA server, which will be received by your Lambda function, and republished into predefined topic names\.

## Set Up a Test OPC\-UA Server<a name="opcua-test-server"></a>

Use the following commands to set up a test OPC\-UA server\. Or, if you already have an OPC\-UA server you'd like to use instead, you may skip this step\.

```console
git clone git://github.com/node-opcua/node-opcua.git
cd node-opcua
git checkout v0.0.64
npm install
node bin/simple_server
```

The server produces the following output:

```console
[ec2-user@<your_instance_id> node-opcua]$ node bin/simple_server
  server PID          : 28585

registering server to :opc.tcp://<your_instance_id>4840/UADiscovery
err Cannot find module 'usage'
skipping installation of cpu_usage and memory_usage nodes
  server on port      : 26543
  endpointUrl         : opc.tcp://<your_instance_id>us-west-2.compute.internal:26543
  serverInfo          :
      applicationUri                  : urn:54f7890cca4c49a1:NodeOPCUA-Server
      productUri                      : NodeOPCUA-Server
      applicationName                 : locale=en text=NodeOPCUA
      applicationType                 : SERVER
      gatewayServerUri                : null
      discoveryProfileUri             : null
      discoveryUrls                   : 
      productName                     : NODEOPCUA-SERVER
  buildInfo           :
      productUri                      : NodeOPCUA-Server
      manufacturerName                : Node-OPCUA : MIT Licence ( see http://node-opcua.github.io/)
      productName                     : NODEOPCUA-SERVER
      softwareVersion                 : 0.0.65
      buildNumber                     : 1234
      buildDate                       : Thu Aug 03 2017 00:13:50 GMT+0000 (UTC)

  server now waiting for connections. CTRL+C to stop
```

## Make sure your Greengrass Group is ready<a name="opcua-group"></a>
+ Create a Greengrass group \(find more details in [Configure AWS IoT Greengrass on AWS IoT](https://docs.aws.amazon.com/greengrass/latest/developerguide/gg-config.html)\.\) 
+ Set up a Greengrass Core on one of the supported platforms \(Raspberry\-pi for [example](https://docs.aws.amazon.com/greengrass/latest/developerguide/setup-filter.rpi.html)\) 
+ [Set up](https://docs.aws.amazon.com/greengrass/latest/developerguide/what-is-gg.html#gg-platforms) your Greengrass Core to be able to run nodejs6\.x Lambda functions

## Use Greengrass OPC\-UA to Interact with your OPC\-UA Server<a name="opcua-interact"></a>

1. Prepare your Lambda function

   Get the code for an OPC\-UA adapter Lambda function from GitHub: 

   ``` nodejs
   cd greengrass-opcua-adapter-nodejs
   npm install
   git apply patch/opcua_client.patch
   git apply patch/factories.patch
   npm install --save jsonfile
   ```

2. Change the file at `node_modules/node-opcua/lib/misc/factories.js`: line 109 to this: 

   ```console
   var generated_source_is_outdated = (!generated_source_exists); 
   ```

   Run this command to make that change: 

   ```console
   sed -i '109s/.*/    var generated_source_is_outdated = (!generated_source_exists);/' node_modules/node-opcua/lib/misc/factories.js
   ```

3. Configure the server and monitored nodes

   Modify the field `EndpointUrl` in the file `publishednodes.json` in config folder which contain the server IP and Port that you want to connect to, as well as the node Ids you would like to monitor\. Here's the example:

   ```json
    [
     {
        "EndpointName": "UNO-2484G",
        "EndpointUrl": "opc.tcp://localhost:26543",
        "OpcNodes": [
        {
            "Id": "ns=1;s=Temperature",
            "DisplayName": "M140001"
        },
        {
            "Id": "ns=1;s=FanSpeed",
            "DisplayName": "M140002"
        },
        {
            "Id": "ns=1;s=PumpSpeed",
            "DisplayName": "M140003"
        }
        ]
     }
    ]
   ```

   In this case, we are connecting to an OPC\-UA server running on the same host as our Greengrass Core, on port 26543, and monitoring multiple nodes that has an OPC\-UA Id `'ns=1;s=Temperature'`, `'ns=1;s=FanSpeed'`, and `'ns=1;s=PumpSpeed'`\. 

4. Configure to authenticate trusted server

   Modify the field `CertPath` in cert_config\.json, which is used to tell OPC\-UA client the received OPC\-UA Server certificate in Ceritificate List is matched or not:

    ```json
    [
     {
        "CertPath": "Directory"
     }
    ]
    ```

5. Upload your Lambda

   Create a Greengrass Lambda function\. You can find more details on how to do that in [Configure the Lambda Function for AWS IoT Greengrass](config-lambda.md)\. In a nutshell, create a Lambda function code archive by doing the following:

   ```
   # Download the nodejs greengrass sdk from 
   #   https://docs.aws.amazon.com/greengrass/latest/developerguide/what-is-gg.html#gg-core-sdk-download.
   
   #  Install Greengrass SDK in the node_modules directory
   tar -zxvf aws-greengrass-core-sdk-js-*.tar.gz -C /tmp/
   unzip /tmp/aws_greengrass_core_sdk_js/sdk/aws-greengrass-core-sdk-js.zip -d node_modules
   
   # Archive the whole directory as a zip file
   zip -r opcuaLambda.zip * -x \*.git\*
   
   # Create an AWS Lambda with the created zip
   aws lambda create-function --function-name <Function_Name> --runtime 'nodejs6.10' --role <Your_Role> --handler 'index.handler' --zip-file opcuaLambda.zip
   ```

   Add this Lambda to your Greengrass Group\. Details are, again, in: [Configure the Lambda Function for AWS IoT Greengrass](config-lambda.md)\.

6. Configure and Deploy the Lambda function to your Greengrass Group

   After creating your AWS Lambda function, you add it to your Greengrass Group\. Follow the instructions in same section as above\. 
   + Make sure to specify the Lambda function as Long\-Running\.
   + Give it at least 64MB of memory size\.

   You can now create a deployment with your latest configuration\. You can find details in [Deploy Cloud Configurations to an AWS IoT Greengrass Core Device](configs-core.md)\.

## Verify that your Lambda function is receiving OPC\-UA Publishes and posting them onto Greengrass<a name="opcua-verify-lambda"></a>

As described in the [Architecture section](#opcua-archi), your Lambda function should start receiving messages from your OPC\-UA server\. If you are using your own custom OPC\-UA server, make sure you trigger a change in the OPC\-UA node Id you specified, so that you see the change received by your Lambda function\. If you are using the example server above, the PumpSpeed node is configured to simulate a series of consecutive updates, so you should expect your Lambda function to receive multiple messages a second\.

You can see messages received by your Lambda function in one of two ways: 
+ Watch the Lambda function’s logs 

   You can view the logs from your Lambda function by running the following command: 

  ```
   sudo cat ggc/var/log/user/us-west-2/your_account_id/your_function_name.log 
  ```

  The logs should look similar to: 

  ```
  [2017-11-14T16:33:09.05Z][INFO]-started subscription : 305964
  
  [2017-11-14T16:33:09.05Z][INFO]-monitoring node id =  ns=1;s=PumpSpeed
  
  [2017-11-14T16:33:09.099Z][INFO]-monitoredItem initialized
  
  [2017-11-15T23:49:34.752Z][INFO]-Publishing message on topic "/opcua/server/node/MyPumpSpeed" with Payload "{"id":"ns=1;s=PumpSpeed","value":{"dataType":"Double","arrayType":"Scalar","value":237.5250759433095}}"
  ```
+ Configure Greengrass to forward messages from your Lambda function to the IoT Cloud\.

  Follow the steps outlined in [Verify the Lambda Function Is Running on the Device](lambda-check.md) to receive messages on the AWS IoT Core console\.

**Note:**
+ Make sure there is a Subscription from your Lambda function going to the IoT Cloud\. Details are in [Configure the Lambda Function for AWS IoT Greengrass](config-lambda.md)\.
+ Since messages are forwarded to the cloud, make sure you terminate either the example server you configured above, or stop the Greengrass core, so that you don't end up publishing a lot of messages to IoT cloud and getting charged for them\!
