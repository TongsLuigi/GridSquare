interface Sortable<T>{
    sort(s: (a: T, b: T)=>number): Sortable<T>;
    shuffle(): Sortable<T>;
    reverse(): Sortable<T>;
}

interface Subset<T>{
    getSubset(c: (a: T)=>boolean): Subset<T>;
    getSubsetNarrowAtOnce(c: (a: T)=>boolean): Subset<T>;
}

class BaseList<T> implements Sortable<T>, Subset<T> {
    private listInstance: Array<T> = null;
    private listSource: Array<T> = null;
    private conditions: Array<(item:any)=>boolean>;

    constructor(listToInit: Array<T>, conditionsToInit: Array<(item:any)=>boolean>) {
        this.listSource = listToInit || [];
        this.conditions = conditionsToInit || [];
    }

    protected getConditions(): Array<(item:any)=>boolean> {
        return [].concat(this.conditions);
    }

    public getConditionsArray(): Array<(item:any)=>boolean> {
        return this.getConditions();
    }

    protected getRawListInstance(): Array<T> {
        return this.listInstance === null ? this.listSource : this.listInstance;
    }

    public getListArray(): Array<T> {
        return [].concat(this.getListInstance());
    }

    public getRawListArray(): Array<T> {
        return [].concat(this.getRawListInstance());
    }

    protected getListInstance(): Array<T> {
        if (this.listInstance == null) {
            var newList = [];
            var j;
            var that: BaseList<T> = this;
            this.listSource.forEach(function(item: T){
                for(j=0; j<that.conditions.length; j++){
                    //一つでも検索条件に合致しないものがあればcontinue
                    if (!that.conditions[j](item)) return;
                }
                newList.push(item);
            });
            this.listInstance = newList;
        }
        return this.listInstance;
    }

    public add(item: T): BaseList<T> {
        this.getListInstance().push(item);
        return this;
    }

    public removeAt(index: number): T {
        return this.getListInstance().splice(index, 1)[0];
    }

    public remove(itemToRemove: T): T {
        var list: Array<T> = this.getListInstance();
        var i;
        for(i=0; i<list.length; i++) {
            if (BaseList.Equals(itemToRemove, list[i])) {
                return this.removeAt(i);
            }
        }
        return null;
    }

    public forEach(f: Function): boolean {
        var i;
        var list = this.getListInstance();
        for(i=0; i<list.length; i++) {
            if (f(list[i]) === true) {
                return true
            }
        }
        return false;
    }

    public exists(item: T): T {
        var i;
        var list = this.getListInstance();
        for(i=0; i<list.length; i++) {
            if (BaseList.Equals(item, list[i])) {
                return list[i];
            }
        }
        return null;
    }

    public size(): number {
        return this.getListInstance().length;
    }

    public getAt(index: number): T {
        return this.getListInstance()[index];
    }

    public concat(another: BaseList<T>): BaseList<T> {
        var newList = this.getListArray();
        newList = newList.concat(another.getListArray());
        return new BaseList<T>(newList, null);
    }

    public clone(): BaseList<T> {
        return new BaseList<T>(this.getListInstance(), null);
    }

    static Equals(a, b): boolean {
        if (a === b || (a && a.equals instanceof Function && b && b.equals instanceof Function && a.equals(b))) {
            return true;
        }
        return false;
    }

    public sort(f: (a: T, b: T)=>number): BaseList<T> {
        this.getListInstance().sort(f);
        return this;
    }

    public shuffle(): BaseList<T> {
        var list = this.getListInstance();
        var j, randIdx;
        var temp;
        for(j=0; j<list.length; j++){
          temp = list[j];
          randIdx = Math.floor(Math.random() * list.length);
          list[j] = list[randIdx];
          list[randIdx] = temp;
        }
        return this;
    }

    public reverse(): BaseList<T> {
        this.getListInstance().reverse();
        return this;
    }

    public getSubset(c: (item:T)=>boolean): BaseList<T> {
        return new BaseList<T>(this.getRawListInstance(), this.getConditions().concat([c]));
    }

    public getSubsetNarrowAtOnce(c: (item:T)=>boolean): BaseList<T> {
        var newList: Array<T> = [];
        this.forEach(function(item: T) {
            if (c(item)) newList.push(item);
        });
        return new BaseList<T>(newList, null);
    }
}
