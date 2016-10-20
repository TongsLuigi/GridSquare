class RemoteGameManager {
    private gameManager: GridSquareGameManager;
    private remoteGameId: string;
    private localPlayerSide: number = 1;
    private remotePlayerSide: number = 2;

    private currentMoveWaitingPlayer: RemoteGamePlayer;
    private remoteServerHelper: RemoteServerHelper;

    constructor(gameManager: GridSquareGameManager) {
        this.gameManager = gameManager;
    }

    public sendRequestNextMove() {
        this.remoteServerHelper.sendRequest(new RemoteServerDataWrapper(RemoteServerHelper.REQUEST_DOMAIN_GAME, RemoteServerHelper.REQUEST_TYPE_REQUEST_NEXT_MOVE));
    }

    public sendRequestNextMovePermission() {
        this.remoteServerHelper.sendRequest(new RemoteServerDataWrapper(RemoteServerHelper.REQUEST_DOMAIN_GAME, RemoteServerHelper.REQUEST_TYPE_REQUEST_MOVE_PERMISSION));
    }

    public sendInputedNextMove(x: number, y: number) {
        var data = new RemoteServerDataWrapper(RemoteServerHelper.REQUEST_DOMAIN_GAME, RemoteServerHelper.REQUEST_TYPE_INPUTED_NEXT_MOVE);
        data.setDataBody({"x": x, "y": y});
        this.remoteServerHelper.sendRequest(data);
    }

    public setRemoteServerHelper(helper: RemoteServerHelper) {
        this.remoteServerHelper = helper;
        this.addRemoteServerResponseReceiveListener();
    }

    private addRemoteServerResponseReceiveListener() {
        var that = this;
        this.remoteServerHelper.addReceiveResponseListener(function(d: RemoteServerDataWrapper) {
            if (d.getRequestDomain() != RemoteServerHelper.REQUEST_DOMAIN_GAME) return;
            if (d.getRequestType() == RemoteServerHelper.REQUEST_TYPE_ALLOW_NEXT_MOVE) {
                that.onNextMoveAllowReceive();
            } else if (d.getRequestType() == RemoteServerHelper.REQUEST_TYPE_UPDATE_REMOTE_MOVE) {
                var data = d.getDataBody();
                var move = data["move"];
                that.onMoveReceive(move, Number(move.x), Number(move.y));
            }
        });
    }

    public setRemoteGameId(id: string) {
        this.remoteGameId = id;
    }

    public getRemoteGameId(): string {
        return this.remoteGameId;
    }

    public setPlayersSide(local: number, remote: number){
        this.localPlayerSide = local;
        this.remotePlayerSide = remote;
    }

    public initGamePlayers() {
        this.gameManager.addGamePlayer(new CanvasBoardRemoteGamePlayer(this.gameManager, this.localPlayerSide, this.gameManager.getCanvasManager(), this));
        this.gameManager.addGamePlayer(new RemoteGamePlayer(this.gameManager, this.remotePlayerSide, this));
    }

    public sendLocalPlayerMove(player: CanvasBoardRemoteGamePlayer, x: number, y: number) {
        //サーバにローカルで入力された手を送信
        this.sendInputedNextMove(x, y);
    }

    public requestNextMove(player: RemoteGamePlayer) {
        //サーバに手を要求
        this.currentMoveWaitingPlayer = player;
        if (player instanceof CanvasBoardRemoteGamePlayer){
            this.sendRequestNextMovePermission();
        } else {
            this.sendRequestNextMove();
        }
    }

    private onMoveReceive(result: Object, x: number, y: number) {
        //サーバから手を受信
        //受信結果と待機中のプレイヤー照合の上
        if (true) {
            this.currentMoveWaitingPlayer.updateRemoteMove(x, y);
        }
    }

    private onNextMoveAllowReceive() {
        //サーバからの手の入力許可
        if (this.currentMoveWaitingPlayer instanceof CanvasBoardRemoteGamePlayer) {
            var player = this.currentMoveWaitingPlayer as CanvasBoardRemoteGamePlayer;
            player.allowPlayerInput();
        }
    }

}
