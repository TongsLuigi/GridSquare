abstract class AbstractGamePlayer{
    private gameManager: GridSquareGameManager;
    protected mySide = 2;

    constructor(gameManager: GridSquareGameManager, mySide: number) {
        this.gameManager = gameManager;
        this.mySide = mySide;
    }

    public getSide() : number {
        return this.mySide;
    }

    protected getGameManager(): GridSquareGameManager {
        return this.gameManager;
    }

    private makeAMoveListener: (gamePlayer: AbstractGamePlayer, x: number, y: number)=>void = function(gamePlayer: AbstractGamePlayer, x: number, y: number) {
        gamePlayer.getGameManager().playerGridPointClick(gamePlayer, x, y);
    };

    public setOnMakeAMoveListener(f: (gamePlayer: AbstractGamePlayer, x: number, y: number)=>void) {
        this.makeAMoveListener = f;
    }

    protected callMakeAMoveListener(x: number, y: number) {
        this.makeAMoveListener && this.makeAMoveListener(this, x, y);
    }

    abstract requestNextMove();
}

class ComputerGamePlayer extends AbstractGamePlayer {
    private enemySide: number = 1;
    constructor(gameManager: GridSquareGameManager, mySide: number) {
        super(gameManager, mySide);
        this.enemySide = mySide == 2 ? 1 : 2;
    }

    public requestNextMove() {
        var that = this;
        setTimeout(function() {
            that.startThinking();
        }, 800);
    }

    private getPointList(): GridPointList {
        return this.getGameManager().getPointList();
    }

    private currentGridSquare: GridSquare = null;

    private getCurrentGridSquare(): GridSquare {
        return this.currentGridSquare;
    }

    private getDefendPercentageWithPhase(currentPhase: number): number {
        if (currentPhase == 50) {
            return 1.0;
        } else if (currentPhase == 100) {
            return 1.0;
        } else if (currentPhase == 150) {
            return 1.0;
        }
    }

    private getDefendSizeWithPhase(currentPhase: number): number {
        if (currentPhase == 50) {
            return 25;
        } else if (currentPhase == 100) {
            return 9;
        } else if (currentPhase == 150) {
            return 9;
        }
    }

    private shouldDefend(pointList: GridPointList): GridPoint {
        var currentPhase = this.getCurrentPhase();
        if (Math.random() >= this.getDefendPercentageWithPhase(currentPhase)) {
            return null;
        }
        var enemyInterruptList: GridSquareList = pointList.searchInsertableRectanglesFreePointPutPoint(this.enemySide, 96, 1, 2, null);
        var emergentList: GridSquareList = enemyInterruptList.getSubsetAreaSizeEqualsOrGreaterThan(49).sortByAreaSize().reverse() as GridSquareList;
        if (emergentList.size() > 0) {
            var square = emergentList.getAt(0);
            return square.getUnusedPoints()[0];
        }
        enemyInterruptList = enemyInterruptList.getSubsetUnusedPointCountEqualsOrLessThan(1);
        var influentialPoints: Array<GridPoint> = enemyInterruptList.getInfluentialPointsAreaSizeEqualsOrGreaterThan(25);
        if (influentialPoints.length > 0) {
            return influentialPoints[0];
        }
        enemyInterruptList = enemyInterruptList.getSubsetAreaSizeEqualsOrGreaterThan(this.getDefendSizeWithPhase(currentPhase)).sortByAreaSize().reverse() as GridSquareList;
        if (enemyInterruptList.size() > 0) {
            var square = enemyInterruptList.getAt(0);
            enemyInterruptList = enemyInterruptList.getSubsetAreaSizeEqualsOrGreaterThan(square.getAreaSize()).shuffle() as GridSquareList;
            square = enemyInterruptList.getAt(0);
            return square.getUnusedPoints()[0];
        }
        return null;
    }

    private getEmergentPoint(pointList: GridPointList): GridPoint {
        var myInsertableSquares: GridSquareList = pointList.searchInsertableRectanglesFreePointPutPoint(this.mySide, 64, 1, 3, null);
        var influentialPoints: Array<GridPoint> = myInsertableSquares.getInfluentialPointsAreaSizeEqualsOrGreaterThan(16);
        if (influentialPoints.length > 0) {
            return influentialPoints[0];
        }
        return null;
    }

    private hasInterrupted(pointList: GridPointList): boolean {
        var square: GridSquare = this.getCurrentGridSquare();
        var points = square.getSortedPoints();
        var i;
        var p;
        for(i=0; i<points.length; i++) {
            p = points[i];
            if (pointList.exists(new GridPoint(p.x, p.y, 0))) {
                return true;
            }
        }
        return false;
    }

    private hasPutAll(): boolean {
        var square: GridSquare = this.getCurrentGridSquare();
        return  (square.getUnusedPoints().length == 0)
    }

    private getAnyPoint(pointList: GridPointList): GridPoint {
        return pointList.getUnusedGridPointList().getAt(0);
    }

    private getNextSquareSizeGreaterThan(pointList: GridPointList, size: number): GridSquare {
        var myInsertableSquares = pointList.searchInsertableRectanglesEachPointOneRectangle(this.mySide, 64, null);
        if (myInsertableSquares.size() == 0)  {
            console.log("CPが作れる正方形がないと判断、バグではないが好ましくない")
            return null;
        }
        var myInsertableSquaresAreaSize = myInsertableSquares.getSubsetAreaSizeEqualsOrGreaterThan(size).shuffle();
        if (myInsertableSquaresAreaSize.size() > 0) {
            console.log("面積優先可能");
            return myInsertableSquaresAreaSize.getAt(0);
        }
        console.log("面積優先不可");
        return myInsertableSquares.getAt(0);
    }

    private getNextSquarePutCountGreaterThan(pointList: GridPointList, putCount: number): GridSquare {
        var putCountList = pointList.searchInsertableRectanglesFreePointPutPoint(this.mySide, 3, 1, putCount, null).sortByAreaSize().reverse();
        if (putCountList.size() > 0) {
            var square = putCountList.getAt(0);
            return square;
        } else {
            return null;
        }
    }

    private getNextSquare(pointList: GridPointList): GridSquare {
        var currentPhase = this.getCurrentPhase();
        var putCountSquare = this.getNextSquarePutCountGreaterThan(pointList, 3);
        if (putCountSquare != null) {
            console.log("3点すでにおいたところ発見");
            return putCountSquare;
        }
        if (currentPhase == 150) {
            console.log("2点すでにおいたところ発見");
            putCountSquare = this.getNextSquarePutCountGreaterThan(pointList, 2);
            if (putCountSquare != null) return putCountSquare;
        }
        return this.getNextSquareSizeGreaterThan(pointList, 9);
    }

    private putNextPoint() {
        var square: GridSquare = this.getCurrentGridSquare();
        var points = square.getSortedPoints();
        var i;
        var p;
        for(i=0; i<points.length; i++) {
            p = points[i];
            if (p.side == -1) {
                this.callMakeAMoveListener(p.x, p.y);
                p.side = this.mySide;
                return;
            }
        }
    }

    private putAnyPoint(pointList: GridPointList) {
        var point: GridPoint = this.getAnyPoint(pointList);
        this.callMakeAMoveListener(point.x, point.y);
    }

    private searchAndSetNextSquare(pointList: GridPointList) {
        this.currentGridSquare = this.getNextSquare(pointList);
    }

    private getCurrentPhase(): number {
        var squareList = this.getGameManager().getSquareList();
        //var myPoints = squareList.getSubsetSideEquals(this.mySide).getPointsSum(); レベル調整するときに使う
        var enemyPoints = squareList.getSubsetSideEquals(this.enemySide).getPointsSum();
        if (enemyPoints <= 50) {
            return 50;
        } else if (enemyPoints <= 100) {
            return 100;
        } else {
            return 150;
        }
    }

    private startThinking() {
        var time = new Date();
        var pointList: GridPointList = this.getPointList();
        var pointToDefend = this.shouldDefend(pointList);
        var pointToAttackEmergent = this.getEmergentPoint(pointList);
        if (pointToDefend == null) {
            if (pointToAttackEmergent == null) {
                if (this.getCurrentGridSquare() == null) {
                    console.log("ないので検索から");
                    this.searchAndSetNextSquare(pointList);
                } else {
                    if (this.hasInterrupted(pointList)) {
                        console.log("妨害された");
                        this.searchAndSetNextSquare(pointList);
                    }
                }
                if (this.getCurrentGridSquare() == null) {
                    this.putAnyPoint(pointList);
                } else {
                    this.putNextPoint();
                    if (this.hasPutAll()) {
                        console.log("全部おいた");
                        this.searchAndSetNextSquare(pointList);
                    }
                }
            } else {
                console.log("緊急でポイントを取りに行くべき場所");
                this.callMakeAMoveListener(pointToAttackEmergent.x, pointToAttackEmergent.y);
            }
        } else {
            console.log("妨害する", pointToDefend);
            this.callMakeAMoveListener(pointToDefend.x, pointToDefend.y);
        }
        console.log("CP探索所要時間", (new Date()).getTime() - time.getTime());
    }
}

class CanvasBoardGamePlayer extends AbstractGamePlayer {
    private canvasManager: GridBoardCanvasManager;
    private isMyTurn: boolean = false;

    constructor(gameManager: GridSquareGameManager, mySide: number, canvasManager: GridBoardCanvasManager) {
        super(gameManager, mySide);
        this.canvasManager = canvasManager;
        var that = this;
        canvasManager.addOnGridButtonClickListener(function(x: number, y: number) {
            if (that.isMyTurn == true) {
                var wasOk = that.callMakeAMoveListener(x, y);
                if (wasOk) {
                    that.isMyTurn = false;
                }
            }
        });
    }

    public requestNextMove() {
        this.isMyTurn = true;
    }
}

class RemoteGamePlayer extends AbstractGamePlayer {
    protected remoteGameManager: RemoteGameManager;

    constructor(gameManager: GridSquareGameManager, mySide: number, remoteGameManager: RemoteGameManager) {
        super(gameManager, mySide);
        this.remoteGameManager = remoteGameManager;
    }

    public requestNextMove (){
        //遠隔ゲームマネージャーに次の手を要求
        this.remoteGameManager.requestNextMove(this);
    }

    public updateRemoteMove(x: number, y: number) {
        this.callMakeAMoveListener(x, y);
    }
}

class CanvasBoardRemoteGamePlayer extends RemoteGamePlayer {
    private canvasManager: GridBoardCanvasManager;
    private isMyTurn: boolean = false;

    constructor(gameManager: GridSquareGameManager, mySide: number, canvasManager: GridBoardCanvasManager, remoteGameManager: RemoteGameManager) {
        super(gameManager, mySide, remoteGameManager);
        this.canvasManager = canvasManager;
        var that = this;
        canvasManager.addOnGridButtonClickListener(function(x: number, y: number) {
            if (that.getGameManager().askIsGamePausing()) return; //また次に実行
            if (that.isMyTurn == true) {
                that.remoteGameManager.sendLocalPlayerMove(that, x, y);
                that.isMyTurn = false;
            }
        });
    }

    public allowPlayerInput() {
        this.isMyTurn = true;
        //ここでUIに何かしら反映する必要がありそう
    }
}
