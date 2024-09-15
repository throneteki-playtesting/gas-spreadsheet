import { Collection } from "mongodb";

export default abstract class MongoDataSource<Model> {
    constructor(protected collection: Collection<Model>) {
        // Empty
    }
    abstract create(model?: object): Promise<number>
    abstract read(model?: object): Promise<Model[]>
    abstract update(model?: object): Promise<number>
    abstract destroy(model?: object): Promise<number>
}