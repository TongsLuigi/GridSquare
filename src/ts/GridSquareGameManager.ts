
class GridSquareGameManager{
    private squareList: GridSquareList;
    private pointList: GridPointList;
    private canvasManager: GridBoardCanvasManager;
    private currentSide: number = 1;
    private hasStarted: boolean = false;
    private isGamePausing = false;
    private anotherGamePlayer: AbstractGamePlayer;
    private gamePlayers: Array<AbstractGamePlayer> = [null, null, null];

    public static MODE_SOLO: number = 10;
    public static MODE_VS_COMPUTER_PLAYER_FIRST: number = 20;
    public static MODE_VS_COMPUTER_COMPUTER_FIRST: number = 25;
    public static MODE_EXHIBITION: number = 30;
    public static MODE_REMOTE = 40;

    public askIsGamePausing(): boolean {
        return this.isGamePausing;
    }

    private getPointFillColor(side: number): string {
        if (side == 1) {
            return "#39e600";
        }
        else if (side == 2) {
            return "#e64d00";
        }
        return "#ffffff";
    }

    private getBorderColor(side: number): string {
        if (side == 1) {
            return "#39e600";
        }
        else if (side == 2) {
            return "#e64d00";
        }
        return "#ffffff";
    }

    private getBoardBgColor(side: number): string {
        return "#080808";
    }

    private getSquareStrokeColor(side: number): string {
        if (side == 1) {
            return "rgba(126, 230, 92, 0.75)";
        } else if (side == 2) {
            return "rgba(230, 153, 115, 0.75)";
        }
        return "#ffffff";
    }

    public setCanvas(canvas: HTMLCanvasElement) {
        this.canvasManager = new GridBoardCanvasManager(canvas);
        this.init();
    }

    private init() {
        this.pointList = new GridPointList(null, null);
        this.squareList = new GridSquareList(null, null);
    }

    constructor(canvas: HTMLCanvasElement) {
        if (canvas != null) this.setCanvas(canvas);
    }

    public pause() {
        this.isGamePausing = true;
        this.canvasManager.setBorderColor("#eee");
    }

    public toPause() {
        this.isGamePausing = true;
    }

    public resume() {
        this.isGamePausing = false;
        this.updatePlayerDisplay();
    }

    public dispose() {
        //ToDo: 必要な後始末がないか考える
        this.isGamePausing = true;
    }

    public setStrokeEnabled(side: number, state: boolean): boolean {
        return this.canvasManager.setStrokeEnabled(side, state);
    }

    public switchStrokeEnabled(side: number): boolean {
        return this.setStrokeEnabled(side, !this.canvasManager.getStrokeEnabled(side));
    }

    public addGamePlayer(player: AbstractGamePlayer) {
        this.gamePlayers[player.getSide()-1] = player;
    }

    public setGameMode(mode: number) {
        if (mode == GridSquareGameManager.MODE_SOLO) {
            this.addGamePlayer(new CanvasBoardGamePlayer(this, 1, this.canvasManager));
            this.addGamePlayer(new CanvasBoardGamePlayer(this, 2, this.canvasManager));
        } else if (mode == GridSquareGameManager.MODE_VS_COMPUTER_PLAYER_FIRST) {
            this.addGamePlayer(new CanvasBoardGamePlayer(this, 1, this.canvasManager));
            this.addGamePlayer(new ComputerGamePlayer(this, 2));
        } else if (mode == GridSquareGameManager.MODE_VS_COMPUTER_COMPUTER_FIRST) {
            this.addGamePlayer(new ComputerGamePlayer(this, 1));
            this.addGamePlayer(new CanvasBoardGamePlayer(this, 2, this.canvasManager));
        } else if (mode == GridSquareGameManager.MODE_EXHIBITION) {
            this.addGamePlayer(new ComputerGamePlayer(this, 1));
            this.addGamePlayer(new ComputerGamePlayer(this, 2));
        } else if (mode == GridSquareGameManager.MODE_REMOTE) {
            // DO NOTHING
        }
    }

    private gridPointClickListener: (x: number, y: number)=>void;
    public setOnGridPointClickListener(f: (x: number, y: number)=>void) {
        this.gridPointClickListener = f;
    }

    private playerSwitchListener: (newPlayer: number, isInterrupting: boolean)=>void;
    public setOnPlayerSwitchListener(f: (newPlayer: number, isInterrupting: boolean)=>void) {
        this.playerSwitchListener = f;
    }

    private gameCompleteListener: ()=>void;
    public setOnGameCompleteListener(f: ()=>void) {
        this.gameCompleteListener = f;
    }

    private updatePlayerDisplay() {
        var newPlayer = this.currentSide;
        this.canvasManager.setBgColor(this.getBoardBgColor(newPlayer));
        this.canvasManager.setBorderColor(this.getBorderColor(newPlayer));
    }

    public switchPlayerTo(newPlayer: number, isInterrupting: boolean) {
        this.currentSide = newPlayer;
        if (!this.isGamePausing) this.updatePlayerDisplay();
        this.playerSwitchListener && this.playerSwitchListener(newPlayer, isInterrupting);
        this.callNextPlayer();
    }

    public getCanvasManager(): GridBoardCanvasManager {
        return this.canvasManager;
    }

    public callNextPlayer() {
        var index = this.currentSide - 1;
        var player: AbstractGamePlayer = this.gamePlayers[index];
        player.requestNextMove();
    }

    public switchPlayer(isInterrupting: boolean) {
        this.switchPlayerTo(this.currentSide == 1 ? 2 : 1, isInterrupting);
    }

    public playerGridPointClick(gamePlayer: AbstractGamePlayer, x: number, y: number) {
        this.onGridPointClick(gamePlayer.getSide(), x, y);
    }

    public injectClickedPoint(side: number, x: number, y: number) {
        var point: GridPoint = new GridPoint(x, y, side);
        var that: GridSquareGameManager = this;

        this.pointList.add(point);
        this.drawColorOnClickedPoint(point);

        if (this.askIsGameFinished()) {
            this.finish();
            return;
        }

        this.pointList.searchInsertedRectanglesWithLimit(1, 1, function(list1: GridSquareList) {
            that.drawSquareWithGridSquareList(list1);
            that.squareList = that.squareList.concat(list1);
        });
        this.pointList.searchInsertedRectanglesWithLimit(2, 1, function(list2: GridSquareList) {
            that.drawSquareWithGridSquareList(list2);
            that.squareList = that.squareList.concat(list2);
        });

        this.gridPointClickListener && this.gridPointClickListener(x, y);

        var player1RestList = this.pointList.searchInsertableRectanglesEachPointOneRectangle(1, 1, null);
        var player2RestList = this.pointList.searchInsertableRectanglesEachPointOneRectangle(2, 1, null);
        if (this.askIsGameFinished()) {
            this.finish();
            return;
        }

    }

    public setCurrentSide(side: number) {
        this.switchPlayerTo(side, false);
    }

    private onGridPointClick(side: number, x: number, y: number): boolean {
        if (side != this.currentSide || this.isGamePausing) return false;

        var point: GridPoint = new GridPoint(x, y, this.currentSide);
        var that: GridSquareGameManager = this;
        if (this.pointList.exists(point)) return false;

        this.pointList.add(point);
        this.drawColorOnClickedPoint(point);

        this.pointList.searchInsertedRectanglesWithLimit(1, 1, function(list1: GridSquareList) {
            that.drawSquareWithGridSquareList(list1);
            that.squareList = that.squareList.concat(list1);
        });
        this.pointList.searchInsertedRectanglesWithLimit(2, 1, function(list2: GridSquareList) {
            that.drawSquareWithGridSquareList(list2);
            that.squareList = that.squareList.concat(list2);
        });
        this.gridPointClickListener && this.gridPointClickListener(x, y);

        var player1RestList = this.pointList.searchInsertableRectanglesEachPointOneRectangle(1, 1, null);
        var player2RestList = this.pointList.searchInsertableRectanglesEachPointOneRectangle(2, 1, null);
        if (this.askIsGameFinished()) {
            this.finish();
            return;
        }

        this.switchPlayer(false);
        return true;
    }

    public askIsGameFinished(): boolean {
        var player1InsertedList = this.squareList.getSubsetSideEquals(1);
        var player2InsertedList = this.squareList.getSubsetSideEquals(2);
        var player1Sum = player1InsertedList.getPointsSum();
        var player2Sum = player2InsertedList.getPointsSum();
        var player1RestList = this.pointList.searchInsertableRectanglesEachPointOneRectangle(1, 1, null);
        var player2RestList = this.pointList.searchInsertableRectanglesEachPointOneRectangle(2, 1, null);
        if ((Math.max(player1Sum, player2Sum) >= 150 && Math.abs(player1Sum - player2Sum) >= 15) || player1RestList.size() == 0 && player2RestList.size() == 0) {
            return true;
        }
        return false;
    }

    public getPointList(): GridPointList {
        return this.pointList.clone();
    }

    public getSquareList(): GridSquareList {
        return this.squareList.clone();
    }

    private drawColorOnClickedPoint(gridPoint: GridPoint) {
        var fillStyle = this.getPointFillColor(gridPoint.side);
        var strokeColor = fillStyle;
        this.canvasManager.drawColorWithGridPoint(gridPoint, {strokeColor: strokeColor, fillStyle: fillStyle, lineWidth: 1});
    }

    private drawSquareWithGridSquare(square: GridSquare) {
        var strokeColor = this.getSquareStrokeColor(square.side);
        var fillColor = null;
        this.canvasManager.drawSquareWithGridSquare(square, {lineWidth: 4, strokeColor: strokeColor, fillStyle: fillColor});
    }

    private drawSquareWithGridSquareList(list: GridSquareList) {
        var that: GridSquareGameManager = this;
        list.forEach(function(square: GridSquare) {
            that.drawSquareWithGridSquare(square);
        });
    }

    public start() {
        this.switchPlayerTo(1, false);
        this.hasStarted = true;
        if (this.isGamePausing) this.pause();
    }

    public askHasStarted():boolean {
        return this.hasStarted;
    }

    public finish() {
        this.gameCompleteListener && this.gameCompleteListener();
        this.currentSide = 0;
    }

}
