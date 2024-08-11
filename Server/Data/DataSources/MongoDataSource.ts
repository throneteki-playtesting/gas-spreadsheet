import { BulkWriteResult, Collection, DeleteResult, InsertManyResult } from "mongodb";

export default abstract class MongoDataSource<Id, Model> {
    constructor(protected collection: Collection<Model>) {
        // Empty
    }
    abstract create({ values }: { values: Model[] }): Promise<InsertManyResult<Model>>
    abstract read({ projectShort, ids }: { projectShort: string, ids?: Id[] }): Promise<Model[]>
    abstract update({ projectShort, values }: { projectShort: string, values: Model[] }): Promise<BulkWriteResult>
    abstract destroy({ projectShort, ids }: { projectShort: string, ids?: Id[] }): Promise<DeleteResult>
}