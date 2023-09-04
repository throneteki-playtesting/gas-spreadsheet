import { DataRow } from "../Data";

abstract class DataObject {
    protected data: DataRow;

    constructor(data: DataRow) {
        this.data = data;
    }

    public get dataRow() {
        this.syncData();
        return this.data;
    }

    abstract syncData(): boolean;
    abstract clone(): any;
}

export { DataObject }