interface MongoDataSource<Model> {
    create(model?: object): Promise<Model[]>
    read(model?: object): Promise<Model[]>
    update(model?: object): Promise<Model[]>
    destroy(model?: object): Promise<Model[]>
};

export default MongoDataSource;