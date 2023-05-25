import { IncomingMessage, Server } from 'http';
import internal = require('stream');
import { WebSocketServer,WebSocket,OPEN } from 'ws';

interface SocketSession {
    isAlive: boolean,
    data   : { [key: string]: any},
    groups : string[],
}

interface SocketPackageInfo {
    action   : 'group' | 'call' | 'auth' | 'broadcast',
    request  : string,
    group    : string,
    packageID: number
}

interface SocketPackage {
    info: SocketPackageInfo,
    data: { [key: string]: any}
}

interface SocketPackageResponse {
    info    : SocketPackageInfo,
    error   : any,
    response: { [key: string]: any}
}


interface SocketRouter {
    [key:string]:(
        requestBody:{ [key: string]: any},
        response:(error: any, response: { [key: string]: any}) => void,
        sessionData:{ [key: string]: any},
        clientGroups:string[],
        emitter:WebSocket
    ) => void
}

export type AuthLoginFn              = (
    data:any,
    setSession:(sessionData:{ [key: string]: any},clientGroups:string[])=> void,
    authResponse:(error: any, clientSideSessionObject: { [key: string]: any}) => void
    ) => void

export class WebSocketNodeServer {
    public  websocketServer : WebSocketServer             = new WebSocketServer({ noServer: true });
    private onSocketError   : (err:Error) => void         = (err:Error) => { console.log(err); };
    private server          : Server | null               = null;
    private routes          : SocketRouter                = {};
    private broadcastPackageID:number                     = 0;
    private heartbeatInterval: number                     = 9000;
    private authTimeout: number                           = 6000;
    private onCloseClientConnection:(session:any) => void = null;
    private httpRequestHandler: (request:IncomingMessage, allow:()=>void, deny:()=>void) => void = null;
    private onAuthReq:AuthLoginFn                         = (
        data:any,
        setSession:(sessionData:{ [key: string]: any},
        clientGroups:string[])=> void,
        authResponse:(error: any, clientSideSessionObject: { [key: string]: any}) => void) => {
            authResponse('No authentication function defined',null);
        };  
    
    constructor(server:Server){
        this.server = server;
    }
    
    OnAuthentication(onAuthentication:(
        credentialsObject:{ [key: string]: any},
        setSession:(sessionData:{ [key: string]: any},clientGroups:string[])=> void,
        authResponse:(error: any, clientSideSessionObject: { [key: string]: any}) => void
        ) => void){
        this.onAuthReq = onAuthentication;
    }

    OnRequest (requestName:string,fn:(
            requestBody:{ [key: string]: any},
            response:(error: any, response: { [key: string]: any}) => void,
            sessionData:{ [key: string]: any},
            clientGroups:string[],
            emitter:WebSocket
        ) => void) {
        this.routes[requestName] = fn;
        return this;
    }

    OnConnectionClose(onCloseClientConnection:(session:any) => void ){
        this.onCloseClientConnection = onCloseClientConnection;
        return this;
    }

    OnHTTPUpgradeRequest (handler :(request:IncomingMessage, allows:()=>void, deny:()=>void) => void){
        this.httpRequestHandler = handler;
        return this;
    }

    public StartListening (){
        this.server.on('upgrade',  (request:IncomingMessage, socketInternal:internal.Duplex, head:Buffer) => {

            socketInternal.on('error',this.onSocketError);
            socketInternal.removeListener('error', this.onSocketError);

            const deny = () => socketInternal.destroy(); 
            const allow    = () => {
                this.websocketServer.handleUpgrade(request, socketInternal, head,(websocket:WebSocket) => {
                    this.websocketServer.emit('connection',request,websocket,socketInternal)
                });
            }
            if ( this.httpRequestHandler ) {
                this.httpRequestHandler(request ,allow,deny);
            } else {
                allow();
            }  
        });

        this.websocketServer.on('connection',(httpRequest:IncomingMessage,websocket:WebSocket, socketInternal:internal.Duplex) => {
            const session:SocketSession = {
                isAlive: true,  // heartbeat
                data   : null,  // session data 
                groups : [],    // groups
            }
            websocket    ['xSession'] = session;                                                      // add session to websocket
            const        closeSocketInternal = () => socketInternal.destroy();                        // close socket internal (at http level)
            setTimeout   (() => (session.data !== null) || closeSocketInternal() ,this.authTimeout);  // client has N seconds to authenticate or will be disconnected
            websocket.on('error', this.onSocketError);                                                // error handler
            websocket.on('pong', () => session.isAlive = true );                                      // heartbeat set isAlive 
            websocket.on('close', () => { 
                if(session.data && this.onCloseClientConnection) this.onCloseClientConnection(session.data);           // if the client was authenticated, call the onCloseClientConnection callback
            });
            websocket.on('message', (message : string) => {
                let { 
                    info, // info about the package, so the package can be routed in server and the response can be tracked when it arrives to the client 
                    data  // data sent by the client
                } = JSON.parse(message) as SocketPackage;
                let { 
                    action ,  // internal action builtIn to be performed by the server. Example: group, call, auth, broadcast
                    request,  // request or route to be performed by the server. Example: join, leave, echo, login, logout, etc
                    group  ,  // group to be joined or leaved
                } = info;
    
                const SendToClient= (error:any,response:{ [key: string]: any} ) => { // function definition to send response to client. Info is the same as was sent by the client
                    let res: SocketPackageResponse = { info, error, response };
                    websocket.send(JSON.stringify(res))
                }
    
                if (session.data){                                          // if the client is authenticated
                   if(action === 'group'){
                        if(request === 'join'){                             // join a group
                            session.groups.push(group);
                            SendToClient(false,{done:true});
                        } else {
                            if(request === 'leave'){                        // leave a group
                                session.groups = session.groups.filter(g => g !== group);
                                SendToClient(false,{done:true});
                            } else {
                                if(request === 'leaveAll'){                 // leave all groups
                                    session.groups = [];
                                    SendToClient(false,{done:true});
                                } else {
                                    SendToClient('invalid group request',{ done : false }); // invalid group request
                                }
                            }
                        }
                    } else {
                        if(action == 'call'){
                            if(request == 'echo') {                         // built in echo. Sends back the data sent by the client. Test the connection 
                                SendToClient(false,{ echoAt: new Date().getTime(), received:data});
                            } else {
                                if(Object.keys(request).length > 0){     // if there are routes defined
                                    if(request in this.routes){                   // if the route exists
                                        this.routes[request](data,SendToClient,session.data,session.groups,websocket); // call the route
                                    } else {
                                        SendToClient('invalid call request',{ done : false });
                                    }
                                } else {                                   // if there are no routes defined
                                    SendToClient('invalid call. No routes defined',{ done : false });
                                }
                            }
                        } else {
                            SendToClient('invalid action',{ done : false });
                        }
                    }
                } else { // if the client is not authenticated
                    if((action === 'auth') && (request === 'login')){ // if the client is trying to authenticate
                        const startSession = (sessionData,groups) => {
                            session.data = sessionData || {};
                            session.groups = groups || [];
                        }
                        this.onAuthReq(data,startSession,SendToClient); // call the authentication function
                    } else {
                        // if the client is not authenticated and is not trying to authenticate, close the socket
                        closeSocketInternal();                        
                    }                     
                }
            });
        });
    
        const heartBeating = setInterval(() => {
            this.websocketServer.clients.forEach(ws => {
                if     (ws['xSession'] === undefined) return ws.terminate();       // if the client is not authenticated, close the socket
                if     (ws['xSession'].isAlive  === false) return ws.terminate();  // if the client is not responding to the heartbeat, close the socket
                ws     ['xSession'].isAlive  = false;                              // set the client as not responding to the heartbeat and wait for the next heartbeat
                ws.ping();                                                         // send the heartbeat
            });
        }, this.heartbeatInterval);
    
        this.websocketServer.on('close', () => clearInterval(heartBeating));
        return this;
    }
        
    Broadcast (eventName:string,groupName:string | null,data:{ [key: string]: any},emitter:WebSocket = null) {
        this.broadcastPackageID++;
        let info: SocketPackageInfo = {  action: 'broadcast', request: eventName, group:groupName, packageID:this.broadcastPackageID  };
        let r : SocketPackageResponse = { info, error: false, response: data };
        let msg = JSON.stringify(r);
        this.websocketServer.clients.forEach((ws:WebSocket) => {
            if (ws.readyState === OPEN && ("xSession" in ws) && (ws !== emitter)) {
                if(groupName){
                    if(ws['xSession']['groups'].includes(groupName))  ws.send( msg);
                } else {
                    ws.send( msg);
                }                
            }
        });
        return this;
    };

    Close () {
        this.websocketServer.close();
        return this;
    };

    SetHeartbeatInterval (time:number) {
        this.heartbeatInterval = time;
        if(this.authTimeout > time){
            this.authTimeout = time * 0.75;
        }
        return this;
    }

    SetTimeoutForAuthenticationRequest (time:number) {
        this.authTimeout = time;
        if(this.heartbeatInterval < time){
            this.heartbeatInterval = time * 1.5;
        }
        return this;
    }

    getServer(){
        return this.websocketServer;
    }

}