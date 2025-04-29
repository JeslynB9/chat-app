# INFO2222_assignment

instructions for implementing server authentication on login if it does not work:
1. Delete old server authentication files to avoid confusion: 

server.key
server.crt
server.csr
localhost.ext

2. run these commands in terminal (make sure you have cd to chatapp)
openssl genrsa -out ca.key 2048
openssl req -x509 -new -nodes -key ca.key -sha256 -days 365 -out ca.crt -subj "/CN=myCA"

3. run in terminal : 
openssl genrsa -out server.key 2048
openssl req -new -key server.key -out server.csr -subj "/CN=localhost"

4. create localhost.ext file in chat app folder. copy & paste the following into the localhost.ext file: 
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost

5. run in terminal :
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 365 -sha256 -extfile localhost.ext

6. make sure server.js is using https instead of http (tell github copilot to fix this if needed)
i.e. should have something like this at the top: 
const https = require('https');
const fs = require('fs');
const express = require('express');

const app = express();

const options = {
    key: fs.readFileSync('server.key'),    // Must point to your real server.key
    cert: fs.readFileSync('server.crt')     // Must point to your real server.crt
};

const server = https.createServer(options, app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

7. open finder - go to folder where project is - open chat app
double click on ca.crt so it opens in Keychain Access
go to file - import items - select ca.crt - import into login OR it should already be there under certificates
right click on ca, get info - expand trust - set it to always trust
quit chrome
restart server (node server.js) and it should work
