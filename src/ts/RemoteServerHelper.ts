class RemoteServerDataWrapper{
    private map: Object = {};

    constructor(requestDomain: string, requestType: string) {
        this.map["REQUEST_DOMAIN"] = requestDomain;
        this.map["REQUEST_TYPE"] = requestType;
    }

    public setDataBody(body: Object) {
        this.map["BODY"] = body;
    }

    public getDataBody() {
        return this.map["BODY"];
    }

    public getRequestDomain(): string {
        return this.map["REQUEST_DOMAIN"];
    }

    public getRequestType(): string {
        return this.map["REQUEST_TYPE"];
    }
}

class RemoteServerHelper{
    public static REQUEST_DOMAIN_ROOM = "ROOM";
    public static REQUEST_DOMAIN_USER = "USER";

    public static REQUEST_DOMAIN_GAME = "GAME";
    //Local -> Server
    public static REQUEST_TYPE_REQUEST_NEXT_MOVE = "REQUEST_NEXT_MOVE";
    public static REQUEST_TYPE_REQUEST_MOVE_PERMISSION = "REQUEST_MOVE_PERMISSION";
    public static REQUEST_TYPE_INPUTED_NEXT_MOVE = "INPUTED_NEXT_MOVE";
    //Server -> Local
    public static REQUEST_TYPE_ALLOW_NEXT_MOVE = "ALLOW_NEXT_MOVE";
    public static REQUEST_TYPE_UPDATE_REMOTE_MOVE = "UPDATE_REMOTE_MOVE";

    private receiveResponseListeners: Array<(d: RemoteServerDataWrapper)=>void> = [];
    private requestListener: (dataWrapper: RemoteServerDataWrapper)=>void = null;

    public sendRequest(daraWrapper: RemoteServerDataWrapper) {
        //通信ラッパーと実際に通信するのはこのHelperを管理するオブジェクト
        this.requestListener && this.requestListener(daraWrapper);
    }

    public addReceiveResponseListener(listener: (d: RemoteServerDataWrapper)=>void) {
        this.receiveResponseListeners.push(listener);
    }

    public setRequestListener(f: (d: RemoteServerDataWrapper)=>void) {
        this.requestListener = f;
    }

    public injectResponse(dataWrapper: RemoteServerDataWrapper) {
        this.onReceiveResponse(dataWrapper);
    }

    private onReceiveResponse(dataWrapper: RemoteServerDataWrapper) {
        //現在の仕様では、対応するrequestが必ずある
        this.receiveResponseListeners.forEach(function(f: Function) {
            f(dataWrapper);
        });
    }
}

class WebSocketWrapper{
    private ws: WebSocket;
    private uri: string;

    private openListener: Function;

    private closeListener: Function;
    private responseListener: (d: Object, i: String) => void;
    private clientsInfoListener: (d: Object) => void;

    private connectCheckTimer = null;
    private lastConnectionCheck: number = null;
    private CHECK_INTERVAL = 30;

    private hasClosed: boolean = false;

    public setOnResponseListener(f: (d: Object, i: String)=>void) {
        this.responseListener = f;
    }

    public setOnClientsInfoListener(f: (d: Object)=>void) {
        this.clientsInfoListener = f;
    }

    public setOnCloseListener(f: Function){
        this.closeListener = f;
    }

    private onWsOpen(e: Event) {
        this.openListener && this.openListener();
        this.setNextCloseTimer();
    }

    private setNextCloseTimer(){
        var that = this;
        this.connectCheckTimer = setTimeout(function() {
            //これまでに次のチェックがこればOK、こなかったら論理切断
            console.log("接続チェック受信不可、強制切断");
            that.close();
        }, this.CHECK_INTERVAL * 1000);
    }

    private onWsMessage(e: MessageEvent) {
        var d = e.data;
        var json = null;
        var response = null;
        var requestId = null;
        var that = this;
        try {
            json = JSON.parse(d);
        } catch (e) {}
        if (json == null) return;
        if (json.MESSAGE_TYPE == "CHECK_CONNECTION_STATE") {
            console.log("接続チェック");
            if (this.connectCheckTimer) {
                console.log("接続チェック受信OK");
                clearInterval(this.connectCheckTimer);
                this.connectCheckTimer = null;
            }
            this.setNextCloseTimer();
            this.lastConnectionCheck = (new Date()).getTime();
            this.tellStateOk();
            return;
        } else if (json.MESSAGE_TYPE == "RESPONSE") {
            response = json.RESPONSE;
            requestId = json.REQUEST_ID;
            if (!response || !requestId) return;
            this.responseListener && this.responseListener(response, requestId);
        } else if (json.MESSAGE_TYPE == "CLIENTS_INFO") {
            this.clientsInfoListener && this.clientsInfoListener(json.RESPONSE);
        }
    }

    private onWsClose(e: CloseEvent) {
        console.log(e);
        this.callCloseListener();
    }

    private onWsError(e: ErrorEvent) {
        console.log(e);
    }

    public close() {
        try {
            this.ws.close();
        } catch(e) {}
        this.callCloseListener();
    }

    private callCloseListener() {
        if (!this.hasClosed) this.closeListener && this.closeListener(null);
        this.hasClosed = true;
    }

    private tellStateOk() {
        this.ws.send(JSON.stringify({
            "MESSAGE_TYPE": "TELL_STATE_OK"
        }));
    }

    public send(data: Object, requestId: String){
        this.ws.send(JSON.stringify({
            "MESSAGE_TYPE": "REQUEST",
            "REQUEST_ID": requestId || "ANY",
            "REQUEST": data
        }));
    }

    constructor(uri: string) {
        this.uri = uri;
    }

    public connect(f: Function) {
        var that = this;
        this.ws = new WebSocket(this.uri);
        setTimeout(function () {
            if (that.ws.readyState != 1) {
                alert("サーバと接続できません。サーバの稼働状況・通信状態を確認してください。");
            }
        }, 1000);
        this.ws.onopen = function(e) {
            that.onWsOpen(e);
        };
        this.ws.onmessage = function(e) {
            that.onWsMessage(e);
        };
        this.ws.onclose = function(e) {
            that.onWsClose(e);
        };
        this.ws.onerror = function(e: ErrorEvent) {
            that.onWsError(e);
        };
        this.openListener = f;
    }

}
