//modelにあたる定義
class GridPoint {
    public x: number;
    public y: number;
    public side: number;
    public createdAt: Date;

    constructor(x: number, y: number, side: number) {
        this.x = x;
        this.y = y;
        this.side = side;
        this.createdAt = new Date();
    }

    public equals(another: GridPoint): boolean {
        //sideは考慮しない
        //falsy同士は考慮しない
        if (this === another || this.x === another.x && this.y == another.y)
            return true;
        return false;
    }

}

class GridPointTool {
    static RoundAngle(s: number, c: number): number{
        if (Math.abs(1 - s) < 0.01) s = Math.round(s);
        if (Math.abs(1 - c) < 0.01) c = Math.round(c);
        if (Math.max(Math.abs(s), Math.abs(c)) == 1) {
            if (c == 1) return 0;
            if (s == 1) return 90;
            if (c == -1) return 180;
            if (s == -1) return 360;
        } else {
            if (s < 0 && c > 0) return 315;
            if (s < 0 && c < 0) return 225;
            if (s > 0 && c < 0) return 135;
            if (s > 0 && c > 0) return 45;
        }
        return 0;
    }

    static SortGridPoints(p: Array<GridPoint>): Array<GridPoint> {
        var xAve = (p[0].x + p[1].x + p[2].x + p[3].x) / 4;
        var yAve = (p[0].y + p[1].y + p[2].y + p[3].y) / 4;
        var r = Math.sqrt(Math.pow(p[0].x - xAve, 2) + Math.pow(p[0].y - yAve, 2));
        p.sort(function(a, b){
            return GridPointTool.RoundAngle((a.y - yAve) / r, (a.x - xAve) / r) >= GridPointTool.RoundAngle((b.y - yAve) / r, (b.x - xAve) / r) ? 1 : -1;
        });
        return p;
    }

    static CalcAreaSize(p: Array<GridPoint>): number {
        if (p[0].x == p[1].x || p[0].y == p[1].y){
            //通常の正方形
            return Math.pow(Math.max(Math.abs(p[0].x - p[1].x), Math.abs(p[0].y - p[1].y)) + 1, 2);
        } else {
            //傾いた正方形
            return Math.pow(Math.max(p[0].y, p[1].y, p[2].y, p[3].y) - Math.min(p[0].y, p[1].y, p[2].y, p[3].y) + 1, 2);
        }
    }

    static CalcAngles(): Array<number>{
        var anglesMap = {};
        var angles = [];
        for(var i=1; i<=8; i++){
            for(var j=1; j<=8; j++){
                anglesMap[i/j] = 1;
            }
        }
        for(var key in anglesMap){
            angles.push(key);
        }
        return angles;
    }

    private static AngleArray: Array<number> = null;
    static GetAngles(): Array<number> {
        if (GridPointTool.AngleArray == null) {
            GridPointTool.AngleArray = GridPointTool.CalcAngles();
        }
        return [].concat(GridPointTool.AngleArray);
    }

    static SearchRectangles(side: number, targetLength: number, basePointsList: GridPointList, searchTargetPointsList: GridPointList, options: any){
        var insertableList = new GridSquareList(null, null);
        var pointsRectangleFound = [];

        options = options || {};
        var eachPointOneRectangle = options["eachPointOneRectangle"]; //最上位の基準点につき一つの正方形しか考慮しない
        var atLeastFreePointCount = options["atLeastFreePointCount"]; //正方形の頂点のうち、指定された数以上は打たれていない点であること
        var atLeastPutPointCount = options["atLeastPutPointCount"]; //正方形の頂点のうち、指定された数以上は打たれた点であること

        var checkShouldFinish = function(): boolean{
            if (targetLength == -1) return false;
            if (insertableList.size() >= targetLength) return true;
            return false;
        }

        var checkFreePointCount = function(p: Array<GridPoint>): boolean {
            if (!atLeastFreePointCount) return true; //定義されていない場合、または0個以上の場合は常に真
            var i;
            var freeCount = 0;
            for(i=0; i<p.length; i++) {
                if (p[i].side == -1) freeCount ++;
                if (freeCount >= atLeastFreePointCount) return true;
            }
            return false;
        }

        var checkPutPointCount = function(p: Array<GridPoint>): boolean {
            if (!atLeastPutPointCount) return true;
            var i;
            var putCount = 0;
            for(i=0; i<p.length; i++) {
                if (p[i].side == side) putCount ++;
                if (putCount >= atLeastPutPointCount) return true;
            }
            return false;
        }

        var checkShouldAddSquare = function(p1: GridPoint, p2: GridPoint, p3: GridPoint, p4: GridPoint): boolean {
            return checkFreePointCount([p1, p2, p3, p4]) && checkPutPointCount([p1, p2, p3, p4]);
        }

        //ふつうの正方形
        basePointsList.forEach(function(item1st){
            //左右をチェック
            var shouldContinue = searchTargetPointsList.getSubsetXNotEquals(item1st.x).getSubsetYEquals(item1st.y).forEach(function(item2nd){
                //左or右の点を一つとる
                var dx = Math.abs(item2nd.x - item1st.x);
                return searchTargetPointsList.getSubsetXEquals(item1st.x).getSubsetYDistanceEquals(item1st.y, dx).forEach(function(item3rd){
                    //同じ距離の上or下の点を一つとる
                    return searchTargetPointsList.getSubsetXYEquals(item2nd.x, item3rd.y).forEach(function(item4th){
                        if (checkShouldAddSquare(item1st, item2nd, item3rd, item4th)) {
                            var rectangle = new GridSquare(item1st, item2nd, item3rd, item4th, side);
                            if (!insertableList.exists(rectangle)){
                                insertableList.add(rectangle);
                                if (checkShouldFinish()) return true;
                                if (eachPointOneRectangle) {
                                    pointsRectangleFound.push(item1st);
                                    return true;
                                }
                            }
                        }
                    });
                });
            });
            if (checkShouldFinish()) return true;
        })

        if (checkShouldFinish()) {
            //条件を満たしていたらただちにreturn
            return insertableList;
        }

        if (eachPointOneRectangle) {
            pointsRectangleFound.forEach(function(item){
                basePointsList.remove(item);
            });
        }

        //つまさき立ち正方形
        basePointsList.forEach(function(item1st){
            var shouldBreak = false;
            GridPointTool.GetAngles().forEach(function(a){
                if (shouldBreak) return;
                var aR = -1 / a;
                return searchTargetPointsList.getSubsetLinearXYWithA(item1st.x, item1st.y, a).forEach(function(item2nd){
                    if (checkShouldFinish()) return;
                    var dxy2 = Math.pow(item2nd.x - item1st.x, 2) + Math.pow(item2nd.y - item1st.y, 2);
                    return searchTargetPointsList.getSubsetLinearXYWithA(item1st.x, item1st.y, aR).forEach(function(item3rd){
                        if (checkShouldFinish()) return;
                        var dxy3 = Math.pow(item3rd.x - item1st.x, 2) + Math.pow(item3rd.y - item1st.y, 2);
                        if (dxy2 == dxy3){
                            return searchTargetPointsList.getSubsetXYEquals(item3rd.x - (item1st.x - item2nd.x), item3rd.y + (item2nd.y - item1st.y)).forEach(function(item4th){
                                if (checkShouldAddSquare(item1st, item2nd, item3rd, item4th)) {
                                    var rectangle = new GridSquare(item1st, item2nd, item3rd, item4th, side);
                                    if (!insertableList.exists(rectangle)){
                                        //このループは重複が発生するのでチェック
                                        insertableList.add(rectangle);
                                        if (checkShouldFinish() || eachPointOneRectangle){
                                            shouldBreak = true;
                                            return true;
                                        }
                                    }
                                }
                            });
                        }
                    });
                });
            });
            if (checkShouldFinish()) return true;
        });
        return insertableList;
    }

}

//あとでGridSquareに変更
class GridSquare {
    public createdAt: Date;
    public side: number;
    private points: Array<GridPoint>;
    private unusedPoints: Array<GridPoint>;
    private areaSize: number;

    constructor(p1: GridPoint, p2: GridPoint, p3: GridPoint, p4: GridPoint, side: number) {
        this.points = GridPointTool.SortGridPoints([p1, p2, p3, p4]);
        this.unusedPoints = this.searchUnusedPoints();
        this.areaSize = GridPointTool.CalcAreaSize(this.points);
        this.side = side;
        this.createdAt = new Date();
    }

    public getSortedPoints(): Array<GridPoint> {
        return [].concat(this.points);
    }

    private searchUnusedPoints(): Array<GridPoint> {
        var list = [];
        this.getSortedPoints().forEach(function(point: GridPoint) {
            if (point.side == -1) list.push(point);
        });
        return list;
    }

    public getUnusedPoints(): Array<GridPoint> {
        return [].concat(this.unusedPoints);
    }

    public getAreaSize(): number {
        return this.areaSize;
    }

    public equals(another: GridSquare): boolean {
        //falsy同士は考慮しない
        if (this === another) return true;
        if (this.getAreaSize() != another.getAreaSize()) return false;
        var myPoints = this.getSortedPoints();
        var itsPoints = another.getSortedPoints();
        var i;
        for(i=0; i<myPoints.length; i++) {
            if (!myPoints[i].equals(itsPoints[i])) return false;
        }
        return true;
    }
}

//のちにGridSquareListにへんこう
class GridSquareList extends BaseList<GridSquare> {
    static FromBaseList(baseList: BaseList<GridSquare>): GridSquareList {
        return new GridSquareList(baseList.getRawListArray(), baseList.getConditionsArray());
    }

    public getSubset(c: (item:GridSquare)=>boolean): GridSquareList {
        return GridSquareList.FromBaseList(super.getSubset(c));
    }

    public concat(c: GridSquareList): GridSquareList {
        return GridSquareList.FromBaseList(super.concat(c));
    }

    public clone(): GridSquareList {
        return GridSquareList.FromBaseList(super.clone());
    }

    public getPointsSum(): number {
        var sum = 0;
        this.forEach(function(item: GridSquare) {
            sum += item.getAreaSize();
        });
        return sum;
    }

    public sortByAreaSize(): GridSquareList {
        this.sort(function(a, b) {
            return a.getAreaSize() >= b.getAreaSize() ? 1 : -1;
        });
        return this;
    }

    public getSubsetSideEquals(side: number): GridSquareList {
        return this.getSubset(function(item: GridSquare) {
            if (side == item.side) return true;
            return false;
        });
    }

    public getSubsetAreaSizeEqualsOrGreaterThan(size: number): GridSquareList {
        return this.getSubset(function(item: GridSquare) {
            if (item.getAreaSize() >= size) return true;
            return false;
        });
    }

    public getSubsetAreaSizeEqualsOrLessThan(size: number): GridSquareList {
        return this.getSubset(function(item: GridSquare) {
            if (item.getAreaSize() <= size) return true;
            return false;
        });
    }

    public getSubsetUnusedPointCountEqualsOrLessThan(count: number): GridSquareList {
        return this.getSubset(function(item: GridSquare) {
            if (item.getUnusedPoints().length <= count) return true;
            return false;
        });
    }

    public getInfluentialPointsAreaSizeEqualsOrGreaterThan(areaSize: number): Array<GridPoint> {
        var pointMap = {};
        var instanceMap = {};
        var key;
        var list: Array<GridPoint> = [];
        this.forEach(function(item: GridSquare) {
            item.getSortedPoints().forEach(function(point: GridPoint) {
                if (point.side == -1) {
                    var key = point.x + "," + point.y;
                    if (!pointMap[key]) pointMap[key] = 0;
                    pointMap[key] += item.getAreaSize();
                    instanceMap[key] = point;
                }
            });
        });
        for(key in pointMap) {
            if (pointMap[key] > areaSize) {
                list.push(instanceMap[key]);
            }
        }
        list.sort(function(a: GridPoint, b: GridPoint) {
            return (pointMap[a.x + "," + a.y] >= pointMap[b.x + "," + b.y]) ? -1 : 1;
        });
        return list;
    }
}

//のちにGridPointListに変更
class GridPointList extends BaseList<GridPoint> {
    static FromBaseList(baseList: BaseList<GridPoint>): GridPointList {
        return new GridPointList(baseList.getRawListArray(), baseList.getConditionsArray());
    }

    public getSubset(c: (item:GridPoint)=>boolean): GridPointList {
        return GridPointList.FromBaseList(super.getSubset(c));
    }

    public getSubsetNarrowAtOnce(c: (item:GridPoint)=>boolean): GridPointList {
        return GridPointList.FromBaseList(super.getSubset(c));
    }

    public concat(c: GridPointList): GridPointList {
        return GridPointList.FromBaseList(super.concat(c));
    }

    public clone(): GridPointList {
        return GridPointList.FromBaseList(super.clone());
    }

    public getUnusedGridPointList(): GridPointList {
        var unusedSpaces: Array<GridPoint> = [];
        var tempSpaces = [];
        var i, j;
        for(i=1; i<=8; i++) tempSpaces[i] = [];
        this.forEach(function(item){
            tempSpaces[item.x][item.y] = true;
        });
        for(i=1; i<=8; i++){
            for(j=1; j<=8; j++){
                if (typeof tempSpaces[i][j] == "undefined" || !tempSpaces[i][j]){
                    unusedSpaces.push(new GridPoint(i, j, -1));
                }
            }
        }
        return new GridPointList(unusedSpaces, null);
    }

    public sortByX(): GridPointList{
        this.sort(function(a: GridPoint, b: GridPoint){
            if (a.x > b.x) {
                return 1;
            } else if (a.x == b.x) {
                return a.y >= b.y ? 1 : -1;
            } else {
                return -1;
            }
        });
        return this;
    }

    public sortByY(): GridPointList{
        this.sort(function(a: GridPoint, b: GridPoint){
            if (a.y > b.y) {
                return 1;
            } else if (a.y == b.y) {
                return a.x >= b.x ? 1 : -1;
            } else {
                return -1;
            }
        });
        return this;
    }

    public sortByCreatedAtDesc(): GridPointList{
        this.sort(function(a: GridPoint, b: GridPoint){
            return a.createdAt.getTime() - b.createdAt.getTime() >= 0 ? -1 : 1;
        });
        return this;
    }

    public getSubsetWithLimit(limit: number): GridPointList{
        var count = 0;
        return this.getSubsetNarrowAtOnce(function(item){
            count++;
            if (count <= limit) return true;
        });
    }

    public getSubsetXGreaterThan(x: number): GridPointList{
        return this.getSubset(function(item){
            if (item.x > x) return true;
        });
    }

    public getSubsetYGreaterThan(y: number): GridPointList{
        return this.getSubset(function(item){
            if (item.y > y) return true;
        });
    }

    public getSubsetXLessThan(x: number): GridPointList{
        return this.getSubset(function(item){
            if (item.x < x) return true;
        });
    }

    public getSubsetXEquals(x: number): GridPointList{
        return this.getSubset(function(item){
            if (item.x == x) return true;
        });
    }

    public getSubsetYEquals(y: number): GridPointList {
        return this.getSubset(function(item){
            if (item.y == y) return true;
        });
    }

    public getSubsetXYEquals(x: number, y: number): GridPointList {
        return this.getSubset(function(item){
            if (item.x == x && item.y == y) return true;
        });
    }

    public getSubsetXNotEquals(x: number): GridPointList {
        return this.getSubset(function(item){
            if (item.x != x) return true;
        });
    }

    public getSubsetYDistanceEquals(y: number, d: number): GridPointList{
        return this.getSubset(function(item){
            if (Math.abs(item.y - y) == d) return true;
        });
    }

    public getSubsetSideEquals(side: number): GridPointList {
        return this.getSubset(function(item){
            if (item.side == side) return true;
        });
    }

    public getSubsetLinearXYWithA(x: number, y: number, a: number){
        return this.getSubset(function(item){
            if (item.x == x && item.y == y) return false;
            var dx = item.x - x;
            //仕様上整数になるとわかっているので丸める
            if (item.y == Math.round(y + (a * dx))) return true;
        });
    }

    //直近に挿入された点を基準として正方形を探索
    public searchInsertedRectanglesWithLimit(side: number, limit: number, cb: Function): GridSquareList {
        var allPointsList = this;
        var basePointsList = allPointsList.sortByCreatedAtDesc().getSubsetWithLimit(limit).getSubsetSideEquals(side);
        var searchTargetPointsList = allPointsList.getSubsetSideEquals(side);
        var result = this.searchRectangles(side, -1, basePointsList, searchTargetPointsList, null);
        cb && cb(result);
        return result;
    }

    //挿入されたすべての点を基準として正方形を探索
    public searchAllInsertedRectangles(side: number, cb: Function): GridSquareList {
        var allPointsList = this;
        var basePointsList = allPointsList.getSubsetSideEquals(side);
        var searchTargetPointsList = basePointsList;
        var result = this.searchRectangles(side, -1, basePointsList, searchTargetPointsList, null);
        cb && cb(result);
        return result;
    }

    //挿入されていないすべての点を基準として正方形を探索
    public searchInsertableRectangles(side: number, targetLength: number, cb: Function): GridSquareList{
        var allPointsList = this;
        var basePointsList = allPointsList.getUnusedGridPointList();
        var searchTargetPointsList = basePointsList.concat(allPointsList.getSubsetSideEquals(side));
        var result = this.searchRectangles(side, targetLength, basePointsList, searchTargetPointsList, null);
        cb&& cb(result);
        return result;
    }

    //（空、敵）＝(1,3),(2,2)の正方形の探索
    //敵の挿入済の点を基準にして、空と敵の集合をループする
    public searchInsertableRectanglesFreePointPutPoint(enemySide: number, targetLength: number, freePoint: number, putPoint: number, cb: Function): GridSquareList {
        var allPointsList = this;
        var unusedPointsList = allPointsList.getUnusedGridPointList();
        var enemyPointsList = allPointsList.getSubsetSideEquals(enemySide);
        var searchTargetPointsList = enemyPointsList.concat(unusedPointsList);
        var result = this.searchRectangles(enemySide, targetLength, enemyPointsList, searchTargetPointsList, {
            "atLeastFreePointCount": freePoint || 1,
            "atLeastPutPointCount": putPoint || 2
        });
        cb&& cb(result);
        return result;
    }

    public searchInsertableRectanglesEachPointOneRectangle(side: number, targetLength: number, cb: Function): GridSquareList{
        var allPointsList = this;
        var basePointsList = allPointsList.getUnusedGridPointList();
        var searchTargetPointsList = basePointsList.concat(allPointsList.getSubsetSideEquals(side));
        var result = this.searchRectangles(side, targetLength, basePointsList, searchTargetPointsList, {
            "eachPointOneRectangle": true
        });
        cb && cb(result);
        return result;
    }

    //探索（staticでも可）
    public searchRectangles(side: number, targetLength: number, basePointsList: GridPointList, searchTargetPointsList: GridPointList, options: any){
        var result = GridPointTool.SearchRectangles(side, targetLength, basePointsList, searchTargetPointsList, options);
        return result;
    }

}
