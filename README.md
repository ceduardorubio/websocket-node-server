# Web Socket Node Server 

## Description
Transform your express / http application server into a websocket server to handle websocket connections, broadcast and receive messages and send response to the received messages from websocket clients.
    - No redis required
    - No database required
    - No Socket.io required
    - Auto reconnection 

USE THIS LIBRARY WITH 

- [web socket server side client](https://www.npmjs.com/package/ws-server-side-client) to connect another server side application to the Web Socket Node Server.

- [web socket browser client](https://www.npmjs.com/package/ws-browser-client) to connect a browser application to the Web Socket Node Server.


## Website
[https://ceduardorubio.github.io/websocketnodeserver/](web socket node server)
- under construction

## Installation
```bash
npm install --save ws-node-server
```
## 1. Setup
Instantiate the WebSocketNodeServer class with the http server instance.
```typescript
import { WebSocketNodeServer } from "ws-node-server";
import http                    from 'http';
import express                 from 'express';
const app    = express();
const server = http.createServer(app);
// app middleware, routes, etc
// ...
const wsServer = new WebSocketNodeServer(server);
```
## 2. Listeners Setup
```typescript
let wsOnAuthReq = (credential:any, setSession:(sessionData,groups) => void, response:(error: any, clientSideSessionObject: { [key: string]: any}) => void) => {
    // validate credentials like username and password
    if(credential.user == "..." && credential.password == "..."){
        let currentToken = GenerateToken();
        AddTokenToDatabase(currentToken);
        // set the session data
        let sessionData = {
            user   : credential.user,
            isAdmin: true,
            token  : currentToken
        }
        // set the groups
        let groups = ['admin'];
        // set the session
        setSession(sessionData,groups);
        // send the response
        response(null,sessionData);
    } else {
        // send the response
        response('invalid credentials',null);
    }
}
let wsOnConnClose = (sessionData:any) => {
    // remove the token from the database
    RemoveTokenFromDatabase(sessionData.token);
}
let wsOnHTTPUpgradeRequest = (req:IncomingMessage,allow: () => void,deny:() => void) => {

    let ipHeader  = request.headers['cf-connecting-ip'] || request.headers['ipHeader-forwarded-for'] || request.connection.remoteAddress;
    let isBanned = IsBannedIP(ipHeader);
    if(isBanned){
        deny();
    } else {
        allow();
    }

}

// set the listeners
// OnAuthentication: listen when a client sends an authentication request
wsServer.OnAuthentication(wsOnAuthReq);
// OnHTTPUpgradeRequest: listen when a client sends an http upgrade request (starts the websocket connection)
wsServer.OnHTTPUpgradeRequest(wsOnHTTPUpgradeRequest);
// OnConnectionClose: listen when a client closes the connection
wsServer.OnConnectionClose(wsOnConnClose);
```
### 2.1 OnAuthentication
Set this listener as a function to handle the incoming authentication requests from the clients. It receives the next parameters: 
- **credentials:** the credential object send by the client, like username and password, token, etc.

- **setSession**  set the session data and groups to the client if the authentication is valid. It receives the next parameters:
    - **sessionData:** used to set the session data to the client. It can be any object.
    - **groups:** used to set the array of strings with the groups to be set to the client.


### 2.2 OnHTTPUpgradeRequest
Set this listener as a function to handle the incoming http upgrade requests from the clients. It receives the next parameters:
- **req:** the http request object.
- **allow:** call this function to allow the connection.
- **deny:** call this function to deny the connection.

### 2.3 OnConnectionClose
Set this listener as a function to handle the incoming connection close requests from the clients. It receives the next parameters:
- **sessionData:** the session data object send  of the client that has closed the connection.



## 3. Connection Setup
```typescript
wsServer.StartListening();
```

## 4. Set Request Handlers
```typescript
wsServers.OnRequest('create/user',(requestBody,response,sessionData,clientGroups,emitter) => {
    let user = requestBody;
    let allowCreate = sessionData.isAdmin || clientGroups.includes('admin');
    if(allowCreate){
        // create user in database
        response(null,{done:true});
    } else {
        response('not allowed',null);
    }
});
```
### 4.1 OnRequest
Set this listener as a function to handle the incoming requests from the clients. It receives the next parameters:
- **requestName:** the name of the request to listen.
- **requestBody:** the request body object send by the client.
- **response:** call this function to send the response to the client. It receives the next parameters:
    - **error:** the error object to be send to the client.
    - **data:** the data object to be send to the client.
- **sessionData:** the session data object of the client that has sent the request.
- **clientGroups:** the array of strings with the groups names of the client that has sent the request.
- **emitter:** the emitter object to send messages to the client that has sent the request.


## 5. Send Broadcast Messages
```typescript
// only to admin group members
wsServers.Broadcast('test',"admin",{yourMessage:'only to admin group members'});
// to everyone
wsServers.Broadcast('test', null,{yourMessage:'to everyone'});
```
### 5.1 Broadcast
Send a broadcast message to all the clients or to a specific group. It receives the next parameters:
- **eventName:** the name of the event to send.
- **groupName:** the name of the group to send the message. If null, the message will be send to all the clients.
- **data:** the data object to be send to the clients.

### 5.2 Broadcast when a request is received
```typescript
wsServers.OnRequest('create/user',(requestBody,response,sessionData,clientGroups,emitter) => {
    let user = requestBody;
    let allowCreate = sessionData.isAdmin || clientGroups.includes('admin');
    if(allowCreate){
        // create user in database
        response(null,{done:true});
        // send a broadcast message to all the clients with the event name 'user/created' and the data object 
        // {user} to be received by the clients
        // except the client that has sent the request (emitter)
        emitter.Broadcast('user/created',null,{user},emitter);
    } else {
        response('not allowed',null);
    }
});
```

### 6. Access to WebSocketServer
```typescript
    let ws = wsServers.getServer();
    // do something with the server websocket, like get the clients, listeners, etc.
    ws.clients.forEach((client) => {
        // do something with the client
    });
```


## READ THE CODE ON

[github: websocket-node-server](https://github.com/ceduardorubio/websocket-node-server)

## License

[MIT](LICENSE)

## Author

Carlos Velasquez - [ceduardorubio](https://github.com/ceduardorubio)

## Keywords

[websocket](https://www.npmjs.com/search?q=keywords:web%20socket), [websocket server](https://www.npmjs.com/search?q=keywords:websocket%server), [websocket node server](https://www.npmjs.com/search?q=keywords:websocket%node%20server)

## Change Log

### 0.0.1
- Initial release
### 0.0.2
- Added the possibility to send broadcast messages, inside a request handler, to all the clients except the client that has sent the request.
- Added the possibility to access to the websocket server to get the clients, listeners, etc.

### 0.0.3
- Fix type module error
### 0.0.5
- Allow clients to send broadcast messages to all the clients or to a specific group.