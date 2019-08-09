/**
* 
* This node red node reads the data from a Luxtronik2 heat pump controller and parses the data.
* It uses the new (as of version 3.81 afaik) websocket interface.
* 
* Copyright 2017 Bouni
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
* http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*
**/

module.exports = function(RED) {
    "use strict";
    const WebSocket = require('ws');

    function query(node, msg, callback) {
        
        const uri = 'ws://' + node.config.host + ':' + node.config.port;
        const login = "LOGIN;" + node.config.password;
        
        node.ws = new WebSocket(uri, 'Lux_WS');

        msg.payload = {};
        node.count = 0;

        node.ws.on('open', function open() {
            node.status({fill:"green",shape:"dot",text:"connected"});

            try {
                node.ws.send(login);
                node.ws.send("REFRESH");
            } catch (e) {
                ws.close();
            }
        });
        
        node.ws.on('message', function (data, flags) {
            processResponse(data, node, msg, callback);
        }); 
    
        node.ws.on('close', function(code, reason) {
            node.status({fill:"grey",shape:"dot",text:"disconnected"});
        });
        
        node.ws.on('error', function(error) {
            node.status({fill:"red",shape:"dot",text:"Error " + error});
        });


    }
    
    function processResponse(data, node, msg, callback) {

        var parseString = require('xml2js').parseString; 
        parseString(data, function(error, json) { 

            if("Navigation" in json) {
                node.status({fill:"green",shape:"dot",text:"process Navigation"});
                // Reply to the REFRESH command, gives us the structure but no actual data
                for(var i in json.Navigation.item) {
                    var name = json.Navigation.item[i].name[0];
                    var id = json.Navigation.item[i].$.id;
                    msg.payload[name] = {};
                    node.ws.send('GET;'+id);
                    node.count++;
                }

            } else {
                // Replys to the GET;<id> commands that get us the actual data
                var rootname = json.Content.name[0];
                if(rootname) {
                    for(var j in json.Content.item) {
                        var group = json.Content.item[j].name[0];
                        node.status({fill:"green",shape:"dot",text:"process "+group});
                        msg.payload[rootname][group] = {};
                        if ('raw' in json.Content.item[j]) {
                            var name = json.Content.item[j].name;
                            var value = json.Content.item[j].value;
                            msg.payload[rootname][group] = value[0];
                        } else if('item' in json.Content.item[j]) {
                            for(var k in json.Content.item[j].item) {
                                var name = json.Content.item[j].item[k].name;
                                var value = json.Content.item[j].item[k].value;
                                msg.payload[rootname][group][name] = value[0];
                            }
                        } 
                    }
                }
                node.count--;
                
                if(node.count == 0) {
                    node.ws.terminate();
                    callback();
                }
            } 
            
        });
    }

    function Luxtronik2wsNode(config) {
        RED.nodes.createNode(this,config);
        this.ws = null;
        this.config = config;
        this.status({fill:"green",shape:"dot",text:"OK"});
        var node = this;
        this.on('input', function(msg) {
            query(node, msg, function() {
                //msg.payload = node.msg;
                node.send(msg);
                node.status({fill:"green",shape:"dot",text:"OK"});
            });
        });
    }

    RED.nodes.registerType("Luxtronik2",Luxtronik2wsNode);
}
