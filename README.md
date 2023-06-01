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
[web socket node server](https://ceduardorubio.github.io/websocketnodeserver/) (under construction)

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
let wsOnAuthReq = (credential:any, setSession:(serverSideSessionData:{ [key: string]: any},clientGroups?:string[], publicAlias?: string | null,available?:boolean,publicInmutableData?:any | null) => void, response:(error: any, clientSideSessionObject: { [key: string]: any}) => void) => {
    // validate credentials like username and password
    let foundUser = FindUserInDatabase(credential.user,credential.password);
    if(foundUser){
        let currentToken = GenerateToken();
        AddTokenToDatabase(currentToken);
        // set the session data
        let serverSideSessionData = {
            user   : foundUser.user,
            name   : foundUser.name,
            email  : foundUser.email,
            isAdmin: true,
            token  : currentToken
            //importantData : ...
        }
        // set the groups
        let clientGroups = foundUser.groups || [];
        // set the public alias (optional) | null;
        // if set this alias will be visible to other clients
        // if not set, the client will not be visible to other clients
        let publicAlias = foundUser.name;
        // set the availability (optional) | true;
        let available = foundUser.availableOnConnect || false;
        // set the public inmutable data (optional) | null;
        publicInmutableData = {
            email: foundUser.email
        }

        // set the session
        setSession(serverSideSessionData,clientGroups,publicAlias,available,publicInmutableData);
        let clientSideSessionData = {
            user   : foundUser.user,
            name   : foundUser.name,
            email  : foundUser.email,
            isAdmin: true,
            token  : currentToken
        }
        // send the response
        response(null,clientSideSessionData);
    } else {
        // send the response
        response('invalid foundUsers',null);
    }
}
let wsOnConnClose = (serverSideSessionData:any) => {
    // remove the token from the database
    RemoveTokenFromDatabase(serverSideSessionData.token);
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

// set the listeners for the messages sent by the clients to other clients 
wsServer.SetOnPrivateMessageSent((sessionSender:SocketSession,sessionReceiver:SocketSession,dataSent:any) => {
    // log or save on database the message sent with the session Sender identifier and session Receiver  identifier 
}); 

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
    - **serverSideSessionData:** used to set the session data to the client. It can be any object.
    - **groups:** used to set the array of strings with the groups to be set to the client.


### 2.2 OnHTTPUpgradeRequest
Set this listener as a function to handle the incoming http upgrade requests from the clients. It receives the next parameters:
- **req:** the http request object.
- **allow:** call this function to allow the connection.
- **deny:** call this function to deny the connection.

### 2.3 OnConnectionClose
Set this listener as a function to handle the incoming connection close requests from the clients. It receives the next parameters:
- **serverSideSessionData:** the session data object send  of the client that has closed the connection.

## 3. Connection Setup
```typescript
wsServer.StartListening();
```

## 4. Set Request Handlers
```typescript
wsServers.OnRequest('create/user',(requestBody,response,serverSideSessionData,clientGroups,emitter) => {
    let user = requestBody;
    let allowCreate = serverSideSessionData.isAdmin || clientGroups.includes('admin');
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
- **serverSideSessionData:** the session data object of the client that has sent the request.
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
wsServers.OnRequest('create/user',(requestBody,response,serverSideSessionData,clientGroups,emitter) => {
    let user = requestBody;
    let allowCreate = serverSideSessionData.isAdmin || clientGroups.includes('admin');
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
### 0.1.0
- Client to client communication (send messages to a specific client)
- Add public alias and available state (true | false) to the session data for client to client communication.
### 0.2.0
- Built-in broadcast messages to all the clients when a client connects or disconnects, updates its public alias or its available state.(Feature will be available on the next version of the client libraries)
- Update onAuthentication function arguments:
    - rename data to credentialsObject:{ [key: string]: any},
        credentialsObject: the credential object send by the client, like username and password, token, etc.
    - rename and update arguments of setSession to startSessionWith: (serverSideSessionData:{ [key: string]: any},clientGroups?:string[], publicAlias?: string | null,available?:boolean,publicInmutableData?:any | null) => void ,
        - serverSideSessionData: used to set the session data to the client on server side. It can be any object.
        - clientGroups(optional,visible to other clients): used to set the array of strings with the groups to be set to the client.
        - publicAlias(optional,visible to other clients): used to set the public alias to the client. It can be any string or null. If null, the authenticating client will not be able to send or receive messages from/to other authenticated clients.
        - available(optional,visible to other clients): used to set the available state to the client. It can be true or false. If false, the authenticating client will not be able to send or receive messages from/to other authenticated clients.
        - publicInmutableData(optional,visible to other clients): used to set the public inmutable data to the client. It can be any object or null
    - authResponse:(error: any, clientSideSessionObject: { [key: string]: any}) => void
        - error: the error object to be send to the client or null. if error is null, the client will be authenticated. if error is not null, the client will not be authenticated.
        - clientSideSessionObject: the client side session object to be send to the client if error is null. It can be any object.
- New function SetOnPrivateMessageSent(fn:((sessionSender:SocketSession,sessionReceiver:SocketSession,dataSent:any) => void ) | null) {
    - fn: the function to be called after a client sends a private message to another client. It receives the next parameters:
        - sessionSender: the session data object of the client that has sent the private message.
        - sessionReceiver: the session data object of the client that has received the private message.
        - dataSent: the data object send by the client that has sent the private message.
### 0.2.1
    - Only Send private messages if you are available
    - Only receive update client state broadcast messages if you are available
    - Default available state is true
### 0.2.3
    - Fix broadcast messages when a client disconnects