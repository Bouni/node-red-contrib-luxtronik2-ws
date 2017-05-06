node-red-contrib-luxtronik2-ws
========================

[Node-RED][1] contribution package for [Luxtronik2][2] heat pump controllers running firmware version  >= 3.81.

# Install

Run the following command in the root directory of your Node-RED install

    npm install node-red-contrib-luxtronik2-ws

Run the following command for global install

    npm install -g node-red-contrib-luxtronik2-ws
   
# How to use

1. Place the node within your flow
2. Configure the IP of your Luxtronik, the port and your webinterface password 
3. Trigger the node via the input, it doesn't matter what type the input is
4. The node querys the heat pump for the data, parses the response and outputs the parsed result

# Authors

The module was developed by Bouni based on reverse engeneering the new Websockets based webinterface of the Luxtronik2.

[1]:https://nodered.org
[2]:http://www.alpha-innotec.ch/fileadmin/content/downloads/Lux_Fachhandwerker_de.pdf
