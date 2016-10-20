class CanvasStyleInfo {
    public shadowColor: string;
    public shadowBlur: number;
    public strokeColor: string;
    public lineWidth: number;
    public fillStyle: string;
    constructor(object: Object) {
        this.shadowColor = object["shadowColor"];
        this.shadowBlur = object["shadowBlur"];
        this.strokeColor = object["strokeColor"];
        this.lineWidth = object["lineWidth"];
        this.fillStyle = object["fillStyle"];
    }
}

class PointStyleWrapper {
    public gridPoint: GridPoint;
    public styleInfo: CanvasStyleInfo;
    constructor(point: GridPoint, style: CanvasStyleInfo) {
        this.gridPoint = point;
        this.styleInfo = style;
    }
}

class SquareStyleWrapper {
    public gridSquare: GridSquare;
    public styleInfo: CanvasStyleInfo;
    constructor(point: GridSquare, style: CanvasStyleInfo) {
        this.gridSquare = point;
        this.styleInfo = style;
    }
}

class GridBoardCanvasManager{
    private canvas: HTMLCanvasElement = null;
    private context: CanvasRenderingContext2D = null;

    private gridPointList: Array<PointStyleWrapper> = [];
    private gridSquareList: Array<SquareStyleWrapper> = [];
    private bgColor: string = "#080808";

    private CANVAS_WIDTH = 360;
    private CANVAS_HEIGHT = 360;

    private DISPLAY_WIDTH = 360;
    private DISPLAY_HEIGHT = 360;

    private SCALE = 4;
    private POINT_MARGIN = 10;
    private CIRCLE_BUTTON_R = 2.3;

    private onGridButtonClickListeners: Array<(x: number, y: number)=>void> = [];

    private isStrokeEnabledEachSide: Array<boolean> = [false, true, true];

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.init();
    }

    public setStrokeEnabled(side: number, state: boolean): boolean {
        this.isStrokeEnabledEachSide[side] = state;
        this.refresh();
        return !state;
    }

    public getStrokeEnabled(side: number): boolean {
        return this.isStrokeEnabledEachSide[side];
    }

    private roundGridLocation(value: number, r: number): number{
        var valueP = value % 1;
        if (valueP <= r){
            return Math.floor(value);
        } else if (valueP >= 1 - r){
            return Math.ceil(value);
        } else {
            return 0;
        }
    }

    public addOnGridButtonClickListener(f: (x: number, y: number)=>void) {
        this.onGridButtonClickListeners.push(f);
    }

    private getGridXYWithElementXY(x: number, y: number): Array<number> {
        var xCandidate = x / (this.SCALE * this.POINT_MARGIN);
        var yCandidate = y / (this.SCALE * this.POINT_MARGIN);
        var r = (3.25 / 2) / this.SCALE;
        return [this.roundGridLocation(xCandidate, r), this.roundGridLocation(yCandidate, r)];
    }

    private init() {
        var that: GridBoardCanvasManager = this;
        this.context = this.canvas.getContext("2d");
        this.canvas.addEventListener("click", function(e){
            var target: HTMLElement = e.target as HTMLElement;
            var rect = target.getBoundingClientRect();
            var x = e.clientX - rect.left;
            var y = e.clientY - rect.top;
            var gridLocation = that.getGridXYWithElementXY(x * (that.CANVAS_WIDTH / that.DISPLAY_WIDTH), y * (that.CANVAS_HEIGHT / that.DISPLAY_HEIGHT));
            if (gridLocation[0] >= 1 && gridLocation[0] <= 8 && gridLocation[1] >= 1 && gridLocation[1] <= 8) {
                that.onGridButtonClickListeners.forEach(function(listener) {
                    listener(gridLocation[0], gridLocation[1]);
                });
            }
        });
        this.refresh();
    }

    public setBgColor(color: string) {
        this.bgColor = color;
        this.refresh();
    }

    public setBorderColor(color: string) {
        this.canvas.style.borderColor = color;
    }

    private drawBgColor(color: string) {
        this.context.lineWidth = 0;
        this.context.fillStyle = color;
        this.context.fillRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);
    }

    private clearCanvas() {
        this.context.clearRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);
    }

    private refresh() {
        var drawnPointMap: Array<Array<boolean>> = [];
        var that: GridBoardCanvasManager = this;
        this.clearCanvas();
        this.drawBgColor(this.bgColor);
        this.gridPointList.forEach(function(item: PointStyleWrapper, index: number) {
            if (!drawnPointMap[item.gridPoint.x]) drawnPointMap[item.gridPoint.x] = [];
            drawnPointMap[item.gridPoint.x][item.gridPoint.y] = true;
            if (index + 1 == that.gridPointList.length) {
                item.styleInfo.shadowColor = "rgba(200, 200, 200, 255)";
                item.styleInfo.shadowBlur = 7;
            } else {
                item.styleInfo.shadowColor = "rgba(200, 200, 200, 0)";
                item.styleInfo.shadowBlur = 0;
            }
            that.doDrawColorWithGridPoint(item.gridPoint, item.styleInfo);
        });
        this.gridSquareList.forEach(function(item: SquareStyleWrapper) {
            that.doDrawSquareWithGridSquare(item.gridSquare, item.styleInfo);
        });
        for(var i=1; i<=8; i++){
            for(var j=1; j<=8; j++){
                if (drawnPointMap[i] && drawnPointMap[i][j]) continue;
                this.doDrawColorOnCanvasGridPoint(i, j, this.CIRCLE_BUTTON_R,  new CanvasStyleInfo({lineWidth: 1, strokeColor: "#555555", fillStyle: "rgba(200, 200, 200, 1)"}));
            }
        }
    }

    private updateContextWithStyleInfo(styleInfo: CanvasStyleInfo) {
        if (!styleInfo) return;
        this.context.lineWidth = styleInfo["lineWidth"] || 3;
        this.context.strokeStyle = styleInfo["strokeColor"] || "rgba(0, 0, 0, 0)";
        this.context.fillStyle = styleInfo["fillStyle"];
        this.context.shadowColor = styleInfo["shadowColor"] || "rgba(0, 0, 0, 0)";
        this.context.shadowBlur = styleInfo["shadowBlur"] || 1;
    }

    private doDrawColorWithGridPoint(gridPoint: GridPoint, styleInfo: CanvasStyleInfo) {
        this.doDrawColorOnCanvasGridPoint(gridPoint.x, gridPoint.y, this.CIRCLE_BUTTON_R, styleInfo);
    }

    private doDrawColorOnCanvasGridPoint(x: number, y: number, r: number, styleInfo: CanvasStyleInfo) {
        this.updateContextWithStyleInfo(styleInfo);
        this.context.beginPath();
        this.context.arc(this.SCALE * x * this.POINT_MARGIN, this.SCALE * y * this.POINT_MARGIN, this.SCALE * r, 0 , Math.PI * 2, false);
        this.context.stroke();
        this.context.fill();
    }

    public drawColorWithGridPoint(point: GridPoint, styleInfo: Object) {
        this.gridPointList.push(new PointStyleWrapper(point, new CanvasStyleInfo(styleInfo)));
        this.refresh();
    }

    private getCenterOfCircleWithXY(x: number, y: number): Array<number> {
        var centerX = this.SCALE * x * this.POINT_MARGIN;
        var centerY = this.SCALE * y * this.POINT_MARGIN;
        return [Math.floor(centerX), Math.floor(centerY)];
    }

    private getCenterOfCircleWithGridPoint(gridPoint: GridPoint): Array<number> {
        return this.getCenterOfCircleWithXY(gridPoint.x, gridPoint.y);
    }

    private moveToWithGridPoint(gridPoint: GridPoint) {
        var point = this.getCenterOfCircleWithGridPoint(gridPoint);
        this.context.moveTo(point[0], point[1]);
    }

    private lineToWithGridPoint(gridPoint: GridPoint) {
        var point = this.getCenterOfCircleWithGridPoint(gridPoint);
        this.context.lineTo(point[0], point[1]);
    }

    private doDrawSquareWithGridSquare(gridSquare: GridSquare, styleInfo: CanvasStyleInfo) {
        if (!this.isStrokeEnabledEachSide[gridSquare.side]) return; //線が無い＝描かないのと等しい
        this.updateContextWithStyleInfo(styleInfo);
        this.context.beginPath();
        var points: Array<GridPoint> = gridSquare.getSortedPoints();
        this.moveToWithGridPoint(points[0]);
        this.lineToWithGridPoint(points[1]);
        this.lineToWithGridPoint(points[2]);
        this.lineToWithGridPoint(points[3]);
        this.context.closePath();
        if (styleInfo.fillStyle) this.context.fill();
        this.context.stroke();
    }

    public drawSquareWithGridSquare(gridSquare: GridSquare, styleInfo: Object) {
        this.gridSquareList.push(new SquareStyleWrapper(gridSquare, new CanvasStyleInfo(styleInfo)));
        this.gridSquareList.sort(function(item1: SquareStyleWrapper, item2: SquareStyleWrapper) {
            var a: GridSquare = item1.gridSquare;
            var b: GridSquare = item2.gridSquare;
            if (a.getAreaSize() == b.getAreaSize()) {
                return a.createdAt > b.createdAt ? 1 : -1;
            } else {
                return a.getAreaSize() > b.getAreaSize() ? -1 : 1;
            }
        });
        this.refresh();
    }
}
