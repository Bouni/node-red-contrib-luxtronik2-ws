/**
* 
* This node red node reads the data from a Luxtronik2 heat pump controller and parses the data.
* It uses the new (as of version 3.88.00) websocket interface.
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

        node.topic_parent = '';
        node.topic_child  = '';
        node.topic_value  = '';
        node.topic = {};

        if('topic' in msg){
            if(msg.topic != '' && msg.topic.toString().includes('/')){
                node.topic        = msg.topic.toString().split('/');
                if(node.topic.length == 2){ // e.g. Betriebsart/Heizkreis
                    node.topic_parent = node.topic[0];
                    node.topic_child  = node.topic[1];
                    if('payload' in msg){
                        node.topic_value = msg.payload.toString();
                    }
                }else{
                    node.topic_value  = '';
                    node.topic_parent = '';
                    node.topic_child  = '';
                    msg.topic = 'Invalid Input message, use: topic: Betriebsart/Heizkreis payload:TARGETVALUE';
                }
            }
        }
        
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
                    if (name == 'Zugang: Benutzer' || 
                        name == 'Access: User' || 
                        name == 'Zeitschaltprogramm' || 
                        name == 'Fernsteuerung') {
                        node.status({fill:"green",shape:"dot",text:"Skipping: "+name});
                    } else{
                        var id = json.Navigation.item[i].$.id;
                        msg.payload[name] = {};
                        node.ws.send('GET;'+id);
                        node.count++;
                    }
                }

            } else {
                // Replys to the GET;<id> commands that get us the actual data
                if (!(json.Content.name)) {
                    // fallback if rootname is not received data
                    var rootname = "Einstellungen" // TODO: Change to "Settings"
                }else{
                    var rootname = json.Content.name[0];
                }

                // Output XML structure with RAW values
                if(node.topic_parent.includes('INFO') || node.topic_child.includes('INFO')){
                    msg.payload['INFO - '+rootname] = json.Content;
                }

                for(var j in json.Content.item) {
                    var group = json.Content.item[j].name[0];
                    node.status({fill:"green",shape:"dot",text:"process "+group});
                    msg.payload[rootname][group] = {};

                    if ('raw' in json.Content.item[j]) {
                        var name = json.Content.item[j].name;
                        var value = json.Content.item[j].value;
                        try {
                            msg.payload[rootname][group][name] = value[0];
                        } catch(err){
                            msg.payload[rootname][group][name] = value;
                        }
                    } else if('item' in json.Content.item[j]) {
                        for(var k in json.Content.item[j].item) {
                            var name = json.Content.item[j].item[k].name;
                            var value = json.Content.item[j].item[k].value;
                            if(typeof value === 'object') {
                               msg.payload[rootname][group][name] = value[0];
                            }
                            if('item' in json.Content.item[j].item[k]) {
                                var group2 = json.Content.item[j].item[k].name[0];
                                node.status({fill:"green",shape:"dot",text:"process "+group2});
                                msg.payload[rootname][group2] = {};
                                delete msg.payload[rootname][group];
                                for(var l in json.Content.item[j].item[k].item) {
                                    var name = json.Content.item[j].item[k].item[l].name;
                                    var value = json.Content.item[j].item[k].item[l].value;
                                    if(typeof value === 'object') {
                                        msg.payload[rootname][group2][name] = value[0];
                                    }
                                }
                            }

                            // Send SET values SET;set_targetid;value
                            if(   json.Content.item[j].name.toString().includes(node.topic_parent)
                                && json.Content.item[j].item[k].name.toString().includes(node.topic_child)
                                && (node.topic_value != '')){

                                msg.topic = msg.topic + ' -> ' + node.topic_value;

                                node.ws.send('SET;set_' + json.Content.item[j].item[k].$.id + ';' + node.topic_value);
                                node.topic_parent = '';
                                node.topic_child  = '';
                                node.topic        = '';
                                node.topic_value  = '';
                                node.ws.send('SAVE;1');
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
