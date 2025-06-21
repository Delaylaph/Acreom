import { Table, Transaction } from 'dexie';
import {
    ICreateChange,
    IDatabaseChange,
    IDeleteChange,
    IUpdateChange,
} from 'dexie-observable/api';
import { defaultsDeep } from 'lodash';
import { v4 } from 'uuid';
import { WorkerContext } from '~/@types/app';
import { ServiceKey, UtilActions } from '~/constants';
import {
    IndexedDBBase,
    IndexedDBMeta,
} from '~/workers/database/indexeddb/base';
import { acreomVaultIndexedDB } from '~/workers/database/indexeddb/connector';
import { ImageObject, IVault } from '~/@types';
import { DeviceWriter } from '~/workers/database/device/writer';
import { AttachmentIO } from '~/workers/database/device/io/attachment';
import { StorageType } from '~/workers/utils/parsers';
import { NoOpParser } from '~/workers/database/device/parser';
import { ProgressReporter } from '~/workers/database/reporter/interface';
import { imageObjectEncryptedProperties } from '~/workers/encryption/datagrams';
import { EncryptionDatagramType } from '~/workers/encryption/constants';
import { EntityEncryption } from '~/workers/database/encryption/entity';
import { IDocument } from '~/components/document/model';

/*

ver 1.0
Pasteol som image ->
1. Ma vault filepath?
2. ANO -> uloz image na disk
3.     -> Zapis do DB -> Entity Type, entity Id, id image-u, lokalna cesta.
4. NIE -> Zapis image data, entity type, entity id image id do indexedDB
       -> Posli image data, entity Type, entity Id, image Id na cloud.
       -> zmaz image data z indexedDB

Sync protocol:
1. Prisiel image create
2. Ma lokalnu cestu
3. ANO -> Precitaj image data z lokalnej cesty
       -> Posli data, entity Type, entity Id, image Id na cloud.
       -> Cez websockety dojde remote url image-u, ktory sa savene do indexedDB
4. NIE -> Ma remote cestu?
       -> ANO -> all good.
          NIE -> Daco sa dojebalo, netusime.

syncToDevice:
1. Prisiel change na image
2. Ma remote url a nema lokalnu cestu a vault ma filepath?
3. ANO -> Stiahni image z cloudu.
4.     -> resolvni lokalnu cestu, zapis data na disk
5.     -> zapis lokalnu cestu do indexedDB

 */

export class ImagesIndexedDB extends IndexedDBBase<ImageObject> {
    shouldStoreLocally = true;
    entity = 'image';
    protected context: WorkerContext;
    public parserIndex = StorageType.IMAGE;
    contentKey = '';

    constructor(ctx: WorkerContext) {
        super(ctx);
        this.context = ctx;
        this.writer = new DeviceWriter(ctx, new AttachmentIO(ctx), this) as any;
        this.parser = new NoOpParser(ctx);
        this.encryption = new EntityEncryption(
            ctx,
            EncryptionDatagramType.IMAGE_OBJECT,
            imageObjectEncryptedProperties,
        );
    }

    public table(vaultId: string): Table<any, string | number> {
        return acreomVaultIndexedDB(vaultId).Images;
    }

    writeAttachment(vault: IVault, filepath: string, content: Uint8Array) {
        return this.writer.create({
            vaultId: vault.id,
            filepath,
            content,
        } as any);
    }

    writeAttachmentBatch(vault: IVault, attachments: ImageObject[]) {
        return this.writer.createBatch(
            vault.id,
            attachments.map(
                e =>
                    ({
                        vaultId: vault.id,
                        filepath: e.filepath!,
                        content: e.data!,
                    } as any),
            ),
        );
    }

    deleteAttachment(vault: IVault, filepath: string) {
        return this.writer.delete({
            vaultId: vault.id,
            filepath,
        } as any);
    }

    async createFilePath(
        entity: Partial<ImageObject>,
        changes: Partial<ImageObject>,
        _writeToDevice: boolean,
        vault: IVault,
        register: Set<string> = new Set(),
    ): Promise<any> {
        const imageEntity = {
            ...entity,
            ...changes,
        };

        const doc = await this.context.$deviceService.Documents.retrieve(
            vault.id,
            imageEntity.entityId!,
        );
        const sep = this.context.$config.os === 'windows' ? '\\' : '/';
        
        const filepathBase = vault.filepath;
            console.log('vault filepath', vault.filepath);
        if (imageEntity.name?.endsWith(imageEntity.ext!)) {
            imageEntity.name = imageEntity.name?.slice(
                0,
                imageEntity.name?.length - ((imageEntity.ext?.length || 0) + 1),
            );
        }
        const filepath = [filepathBase, 'attachments', imageEntity.name].join(sep);
        return this.getAvailableFilepath(
            filepath,
            imageEntity.filepath || undefined,
            register,
            `.${imageEntity.ext}`,
        );
    }

    removeFilepaths(vaultId: string): undefined | Promise<void> {
        if (!this.shouldStoreLocally) return;

        return new Promise<void>(resolve => {
            this.database(vaultId).transaction(
                'rw',
                this.table(vaultId),
                async (trx: Transaction) => {
                    (trx as Transaction & { source: string }).source = 'device';
                    await this.table(vaultId)
                        .toCollection()
                        .modify({
                            filepath: undefined,
                            isOnDisk: undefined,
                        } as ImageObject);
                    trx.on('complete', () => {
                        resolve();
                    });
                },
            );
        });
    }

    fetchImageFromRemote(image: ImageObject) {
        return this.context.$deviceService.ImageData.fetchImageFromRemote(
            image,
        );
    }

    protected async syncToDevice(
        vault: IVault,
        change: IDatabaseChange,
    ): Promise<void> {
        if (!vault.filepath) return;
        const isRemote = await this.isRemoteChange(vault.id, change);
        if (!isRemote) return;
     
        const imageObj =
            change.type === 3
                ? ((change as IDeleteChange).oldObj as ImageObject)
                : ((change as ICreateChange).obj as ImageObject);

        const fetchAndSaveImage = async (
            imageObj: ImageObject,
        ): Promise<any> => {
            const imageData = await this.fetchImageFromRemote(imageObj);
            if (!imageData) return;
            await this.writeAttachment(vault, imageObj.filepath!, imageData);
            await this.save(
                vault.id,
                { id: imageObj.id, isOnDisk: true },
                {
                    writeToDevice: false,
                    clientId: v4(),
                },
            );
        };

        switch (change.type) {
            case 1:
                if (imageObj.filepath && imageObj.remoteUri) {
                    await fetchAndSaveImage(imageObj);
                    break;
                }
                if (
                    vault.filepath &&
                    !imageObj.filepath &&
                    imageObj.remoteUri
                ) {
                    const filepath = await this.createFilePath(
                        imageObj,
                        imageObj,
                        false,
                        vault,
                    );
                    imageObj.filepath = filepath;

                    await this.save(vault.id, imageObj, {
                        writeToDevice: false,
                    });
                }
                break;
            case 2:
                if (
                    !(change as IUpdateChange).mods.filepath ||
                    !imageObj.remoteUri
                )
                    break;
                await fetchAndSaveImage(imageObj);
                break;
            case 3:
                if (!imageObj) return;
                if (!vault.filepath || !imageObj.filepath) break;
                await this.deleteAttachment(vault, imageObj.filepath);
                break;
        }
    }

    async saveBulk(
        vaultId: string,
        entities: Partial<ImageObject>[],
        meta?: Partial<IndexedDBMeta>,
    ): Promise<Partial<ImageObject>[]> {
        const databaseEntities = await this.list(
            vaultId,
            undefined,
            dbEntity => {
                return entities.some(
                    e =>
                        e.id === dbEntity.id ||
                        (e.filepath && e.filepath === dbEntity.filepath),
                );
            },
        );

        for (const entity of entities) {
            const dbEntity =
                databaseEntities.find(
                    e =>
                        e.id === entity.id ||
                        (e.filepath && e.filepath === entity.filepath),
                ) ?? null;
            if (
                !dbEntity &&
                entity.filepath &&
                entity.isOnDisk &&
                !entity.data
            ) {
                const imageContent =
                    await this.context.$deviceService.ImageData.readFromDisk(
                        vaultId,
                        entity as ImageObject,
                    );
                if (!imageContent) continue;
                await this.context.$deviceService.ImageData.save(
                    vaultId,
                    {
                        id: entity.id,
                        data: imageContent,
                    },
                    meta,
                );
            }
            if (entity.data) {
                await this.context.$deviceService.ImageData.save(
                    vaultId,
                    {
                        id: entity.id,
                        data: entity.data,
                    },
                    meta,
                );
            }
        }

        return super.saveBulk(vaultId, entities, meta);
    }

    async encryptAllContent(
        vaultId: string,
        reporter?: ProgressReporter,
    ): Promise<void> {
        let paginationId = null;
        const vault = acreomVaultIndexedDB(vaultId);
        let data = [];
        if (!vault) return;

        const count = await this.table(vaultId).count();
        reporter?.increaseTotal(count);

        do {
            data = await this.list(vaultId, undefined, undefined, paginationId);
            const entities =
                await this.context.$deviceService.Documents.listByIds(
                    vaultId,
                    data.map(e => e.entityId!),
                );
            const entitiesMap = entities.reduce((acc, e) => {
                acc[e.id] = e;
                return acc;
            }, {} as any);
            paginationId = data[data.length - 1]?.id ?? null;
            for (const imageObject of data) {
                const imageData =
                    await this.context.$deviceService.ImageData.retrieveDecryptedImage(
                        vaultId,
                        imageObject,
                    );
                if (!imageData) continue;
                const entity = entitiesMap[imageObject.entityId!] as IDocument;
                const encrypt = !entity?.sharingUuid;
                await this.context.$deviceService.ImageData.save(
                    vaultId,
                    {
                        id: imageObject.id,
                        data: imageData,
                    },
                    {
                        writeToDevice: false,
                        encrypt,
                    },
                );
                this.saveForSharing(vaultId, imageObject, encrypt);
            }
            reporter?.progress(data.length);
        } while (data.length > 0);
    }

    async encryptOnDisableSharing(vaultId: string, id: string) {
        const imageObject = await this.retrieve(vaultId, id, {
            decrypt: false,
        });
        if (!imageObject) return null;
        const imageData =
            await this.context.$deviceService.ImageData.retrieveDecryptedImage(
                vaultId,
                imageObject,
            );
        if (!imageData) return null;
        await this.context.$deviceService.ImageData.save(
            vaultId,
            {
                id: imageObject.id,
                data: imageData,
            },
            {
                writeToDevice: false,
                encrypt: true,
            },
        );
        return this.saveForSharing(vaultId, imageObject, true);
    }

    async decryptForSharing(vaultId: string, id: string) {
        const imageObject = await this.retrieve(vaultId, id);
        if (!imageObject) return null;
        const imageData =
            await this.context.$deviceService.ImageData.retrieveDecryptedImage(
                vaultId,
                imageObject,
            );
        if (!imageData) return null;
        await this.context.$deviceService.ImageData.save(
            vaultId,
            {
                id: imageObject.id,
                data: imageData,
            },
            {
                writeToDevice: false,
                encrypt: false,
            },
        );
        return this.saveForSharing(vaultId, imageObject, false);
    }

    async saveForSharing(
        vaultId: string,
        entity: Partial<ImageObject>,
        encrypt: boolean,
    ) {
        if (encrypt) {
            (entity as any).encryptionKey =
                this.encryption.createEncryptionKey();
            entity = (await this.encryption?.encryptContent(
                vaultId,
                entity as any,
                null,
            )) as any;
            entity.encrypted = true;
        } else {
            entity.encryptionKey = null;
            entity.encryptedData = null;
            entity.encrypted = false;
        }

        return await new Promise(resolve => {
            this.database(vaultId).transaction(
                'rw',
                this.table(vaultId),
                async (trx: Transaction) => {
                    (trx as Transaction & { source: string }).source = 'device';
                    await this.table(vaultId).update(
                        entity.id as string,
                        entity,
                    );
                    trx.on('complete', () => {
                        resolve(entity);
                    });
                },
            );
        });
    }

    async save(
        vaultId: string,
        entity: Partial<ImageObject>,
        meta?: Partial<IndexedDBMeta>,
    ): Promise<Partial<ImageObject>> {
        meta = defaultsDeep(meta, {
            encrypt: true,
        });
        entity = {
            ...entity,
            vaultId,
        };

        const databaseEntity = await this.retrieve(vaultId, entity.id!);
        const imageOwner = await this.context.$deviceService.Documents.retrieve(
            vaultId,
            databaseEntity?.entityId ?? entity!.entityId!,
        );
        if (imageOwner && !!imageOwner?.sharingUuid) {
            meta!.encrypt = false;
        }
        const imageData = entity.data;
        entity.data = null;

        entity.encryptionKey = !meta?.encrypt
            ? null
            : entity?.encryptionKey ??
              databaseEntity?.encryptionKey ??
              this.encryption.createEncryptionKey();

        if (this.shouldCreateFilepath(vaultId, entity, entity, meta)) {
            const filepath = await this.createFilePath(
                entity,
                entity,
                true,
                acreomVaultIndexedDB(vaultId).vault,
            );
            (entity as any).filepath = filepath;
        }
        if (entity.filepath && imageData) {
            await this.writeAttachment(
                acreomVaultIndexedDB(vaultId).vault,
                entity.filepath,
                imageData,
            );
            entity.isOnDisk = true;
        }

        if (imageData) {
            await this.context.$deviceService.ImageData.save(
                vaultId,
                {
                    id: entity.id,
                    vaultId: entity.vaultId,
                    data: imageData,
                },
                meta,
            );
        }
        return super.save(vaultId, entity, meta);
    }

    async syncAllToDevice(
        vault: IVault,
        opts: { extension?: string } = {},
        reporter?: ProgressReporter,
    ): Promise<void> {
        const count = await this.table(vault.id).count();
        reporter?.increaseTotal(count);

        let paginationId = null;
        const dataGenerator = this.listPaginated(vault.id, paginationId);
        const register = new Set<string>();
        await this.table(vault.id)
            .toCollection()
            .filter(e => !!e.filepath)
            .each(e => {
                register.add(e.filepath);
            });
        let result: IteratorResult<any[]>;
        let data: ImageObject[] = [];
        do {
            const attachmentsToWrite: ImageObject[] = [];

            result = await dataGenerator.next();
            data = (result.value as ImageObject[]).filter(
                image => !!image.remoteUri,
            );
            paginationId = data[data.length - 1]?.id ?? null;

            const folderIds = data.map(e => e.folderId!);
            const folders =
                await this.context.$deviceService.Projects.listByIds(
                    vault.id,
                    folderIds.filter(e => !!e),
                );
            const foldersMap = new Map<string, string>();
            for (const folder of folders) {
                foldersMap.set(folder.id, folder.filepath!);
            }

            const processBatch = async (images: ImageObject[]) => {
                try {
                    const data = await Promise.all(
                        images.map(e =>
                            this.context.$deviceService.ImageData.retrieveDecryptedImage(
                                vault.id,
                                e,
                            ).catch(err => {
                                console.log(err);
                                return null;
                            }),
                        ),
                    );
                    for (const image of images) {
                        if (image.filepath && image.isOnDisk) continue;
                        const imageData = data.shift();
                        if (!imageData) continue;
                        if (image.filepath) {
                            attachmentsToWrite.push({
                                ...image,
                                data: imageData,
                            });
                            continue;
                        }
                        const parentPath =
                            foldersMap.get(image.folderId!) ?? vault.filepath!;
                        const ext = image.ext;
                        const imageFileBase = [
                            parentPath,
                            image.name?.split('.').slice(0, -1).join('.'),
                        ].join(this.sep);
                        const filepath = await this.getAvailableFilepath(
                            imageFileBase,
                            undefined,
                            register,
                            `.${ext}`,
                        );
                        attachmentsToWrite.push({
                            ...image,
                            filepath,
                            isOnDisk: true,
                            data: imageData,
                        });
                    }
                } catch (e) {
                    console.log(e);
                }
            };

            const batchSize = 4;
            while (data.length > batchSize) {
                const batch = data.splice(0, batchSize);
                await processBatch(batch).catch(e => console.log(e));
            }

            await processBatch(data).catch(e => console.log(e));
            this.emit(ServiceKey.UTILS, UtilActions.INDEX_ENTITY, {
                vaultId: vault.id,
                type: this.parserIndex,
                entity: data,
            });
            try {
                await this.writeAttachmentBatch(vault, attachmentsToWrite);
            } catch (e) {
                console.log(e);
            }

            await this.saveBulk(
                vault.id,
                attachmentsToWrite.map((data: ImageObject) => {
                    return {
                        ...data,
                        data: undefined,
                    };
                }),
                {
                    writeToDevice: false,
                    postprocess: false,
                    clientId: this.clientId,
                },
            ).catch(e => console.log(e));
            reporter?.progress(data.length);
        } while (!result.done && data.length);
        dataGenerator.return();
    }

    protected async subprocessLocalChanges(
        vaultId: string,
        change: IDatabaseChange,
    ): Promise<void> {
        await super.subprocessLocalChanges(vaultId, change);

        const vault = acreomVaultIndexedDB(vaultId);
        if (!vault.filepath) return;
        if (change.type === 3) return;
        await this.rewriteDocumentWithImage(
            vaultId,
            (change as ICreateChange | IUpdateChange).obj,
        );
    }

    protected async subprocessRemoteChanges(
        vaultId: string,
        change: IDatabaseChange,
    ): Promise<void> {
        await super.subprocessRemoteChanges(vaultId, change);

        const vault = acreomVaultIndexedDB(vaultId);
        if (!vault.filepath) return;
        if (change.type === 3) return;
        await this.rewriteDocumentWithImage(
            vaultId,
            (change as ICreateChange | IUpdateChange).obj,
        );
    }

    async rewriteDocumentWithImage(vaultId: string, imageObj: ImageObject) {
        const doc = await this.context.$deviceService.Documents.retrieve(
            vaultId,
            imageObj.entityId,
        );
        if (!doc) return;
        await this.context.$deviceService.Documents.save(vaultId, doc, {
            writeToDevice: true,
        });
    }
}
