import { IncomingMessage } from "http"
import { WebSocket } from "ws"

export interface SocketSession {
    isAlive: boolean,
    data   : SocketPackageData,
    groups : string[],
}

export interface SocketPackage {
    info: SocketPackageInfo,
    data: SocketPackageData
}

export interface SocketPackageInfo {
    action   : 'group' | 'call' | 'auth' | 'broadcast',
    request  : string | number,
    group    : string,
    packageID: number
}

export interface SocketPackageData {
    [key: string | number]: any
}

export interface SocketPackageResponse {
    info    : SocketPackageInfo,
    error   : any,
    response: SocketPackageData
}

export interface SocketServerCallsStack {
    [key: number]: SocketFn
}

export interface SocketListeners {
    [key: string]: SocketFn[]
}

export type SocketFn                 = (error: any, response: SocketPackageData) => void
export type AuthLoginFn              = (data:any,setSession:(data:SocketPackageData)=> void ,closeSocketInternal:() => void,SendToClient:SocketFn,httpRequest:IncomingMessage) => void
export type AuthLogoutFn             = (sessionData:SocketPackageData,SendToClient:SocketFn) => void
export type MiddlewareFn             = (data:SocketPackageData,response:SocketFn,sessionData:SocketPackageData,groups:string[]) => void
export type SocketHttpRequestHandler = (httpRequest:IncomingMessage,cbGranted:() => void, cbNotGranted:() => void) => void

export interface SocketRouter {
    [key:string | number]:MiddlewareFn
}

export interface SocketServer {
    On                                : (requestOrRouteName:string,cb:MiddlewareFn) => void
    OnRequest                         : (requestOrRouteName:string,cb:MiddlewareFn) => void
    SetRoute                          : (requestOrRouteName:string,cb:MiddlewareFn) => void
    SetCall                           : (requestOrRouteName:string,cb:MiddlewareFn) => void
    Close                             : () => void
    Broadcast                         : (name:string,group:string | null,data:SocketPackageData,emitter?:WebSocket) => void
    SetTimeoutForAuthenticationRequest: (timeout:number) => void
    SetHeartbeatInterval              : (timeout:number) => void
    SetOnLogout                       : (logoutFn:AuthLogoutFn) => void
    SetRequestHandler                 : (httpRequestHandler:SocketHttpRequestHandler) => void

}