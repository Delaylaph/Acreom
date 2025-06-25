import { Context } from '@nuxt/types';
import { v4 } from 'uuid';
import { isSameDay, startOfDay } from 'date-fns';
import { saveAs } from 'file-saver';
import isEmpty from 'lodash/isEmpty';
import cloneDeep from 'lodash/cloneDeep';
import { IDocument } from '~/components/document/model';
import { createTaskDateObject, extractDate } from '~/helpers';
import {
    DatabaseServiceAction,
    NotificationActions,
    PageStatus,
    ServiceKey,
    TabType,
    ViewType,
} from '~/constants';
import InterfaceValidationCheckCircle from '~/components/streamline/InterfaceValidationCheckCircle.vue';
import InProgressIcon from '~/components/icons/InProgressIcon.vue';
import InterfaceDeleteSquare from '~/components/streamline/InterfaceDeleteSquare.vue';
import InterfaceGeometricCircleAlternate from '~/components/streamline/InterfaceGeometricCircleAlternate.vue';
import InterfaceEditSelectAreaCircleDash from '~/components/streamline/InterfaceEditSelectAreaCircleDash.vue';
import {
    TrackingAction,
    TrackingActionSource,
    TrackingType,
} from '~/@types/tracking';

export class PageUtils {
    private context: Context;

    constructor(ctx: Context) {
        this.context = ctx;
    }

    async newPage(
        doc?: Partial<IDocument>,
        options: { showNotification?: boolean } = {},
    ) {
        let projectId = doc?.projectId || null;
        let sharingUuid = doc?.sharingUuid || null;
        const dailyDoc = doc?.dailyDoc || null;
        let notificationTitle = 'Page added';
        let notificationDescription = null;

        const activeFolder = this.context.$entities.folder.getActiveFolder();
        if (activeFolder) {
            projectId = projectId ?? activeFolder.id;
            if (!sharingUuid && activeFolder.sharingUuid) {
                sharingUuid = v4();
            }
        }

        const activeTab = this.context.$tabs.activeTab();

        if (activeTab?.type === TabType.VIEW) {
            const view = this.context.$entities.view.byId(activeTab.entityId);
            if (view) {
                const definition = view.definition.length
                    ? view.definition[0]
                    : null;

                const labelsFilter: any = definition?.definition?.find(
                    (def: any) => {
                        return def.property === 'labels';
                    },
                );

                const tasksFilter: any = definition?.definition?.find(
                    (def: any) => {
                        return def.property === 'tasks';
                    },
                );

                if (
                    tasksFilter?.operation === 'has' ||
                    labelsFilter?.value?.length
                ) {
                    notificationTitle = 'Page added, but not visible';
                    notificationDescription =
                        'For a page to be visible, it must match your view filters.';
                }
            }
        }

        const newDocument = {
            ...(doc ?? {}),
            id: v4(),
            sharingUuid,
            projectId,
            dailyDoc,
            content: '<p></p>',
            status: 'new',
            updatedAt: new Date(),
            createdAt: new Date(),
        };

        if (activeTab?.entityId === ViewType.TEMPLATES) {
            newDocument.template = true;
        }

        await this.context.store.dispatch('document/new', newDocument);
        this.context.store.dispatch('document/update', newDocument);

        if (options.showNotification) {
            const callback = () => {
                const tab = this.context.$tabs.createNewTabObject(
                    newDocument.id,
                    TabType.DOCUMENT,
                );
                this.context.$tabs.openTab(tab);
            };

            this.context.$notification.show({
                component: () =>
                    import('@/components/notifications/MiscNotification.vue'),
                bind: {
                    displayText: notificationTitle,
                    description: notificationDescription,
                    actionText: 'Show page',
                    action: NotificationActions.REDIRECT,
                    callback,
                },
            });
        }

        return newDocument.id;
    }

    async clearDate(page: IDocument) {
        if (!page) return;
        await this.context.store.dispatch('document/update', {
            id: page.id,
            start: null,
        });
        this.context.$tracking.trackEvent('document', {
            action: 'clear date',
            entity_id: page.id,
        });
    }

    async schedulePage(page: IDocument, date: Date | null) {
        const oldDate = startOfDay(extractDate(page.start));
        await this.context.store.dispatch('document/update', {
            id: page.id,
            start: createTaskDateObject(date, null),
            end: null,
        });

        if (!date) {
            this.context.$tracking.trackEvent('document', {
                action: 'remove date',
                entity_id: page.id,
            });
        } else {
            this.context.$tracking.trackEvent('document', {
                action: 'add date',
                entity_id: page.id,
            });
        }

        this.context.$utils.refreshCalendarData();
        if (date) {
            if (!isSameDay(oldDate, date)) {
                if (this.context.$utils.isMobile) return;
                this.context.$notification.show({
                    component: () =>
                        import(
                            '@/components/notifications/MiscNotification.vue'
                        ),
                    bind: {
                        callback: () => {
                            const tab = this.context.$tabs.createNewTabObject(
                                page.id,
                                TabType.DOCUMENT,
                            );
                            this.context.$tabs.openTab(tab);
                            this.context.$tracking.trackEventV2(
                                TrackingType.PAGE,
                                {
                                    action: TrackingAction.OPEN,
                                    source: TrackingActionSource.NOTIFICATION,
                                },
                            );
                        },
                        action: NotificationActions.REDIRECT,
                        displayText: 'Page Scheduled',
                        actionText: 'Show',
                    },
                });
            }
        }
    }

    async archivePage(page: IDocument) {
        const payload = {
            updatedAt: new Date(),
            id: page.id,
            archived: true,
        };
        await this.context.$tabs.closeTabsByEntityId(page.id);
        await this.context.store.dispatch('document/update', payload);
        this.context.$tracking.trackEvent('document', {
            action: 'archive',
            entity_id: page.id,
        });
        this.context.$notification.show({
            component: () =>
                import('@/components/notifications/MiscNotification.vue'),
            bind: {
                displayText: 'Page Archived',
            },
        });
    }

    async restorePage(page: IDocument) {
        const payload = {
            updatedAt: new Date(),
            id: page.id,
            archived: false,
        };
        await this.context.store.dispatch('document/update', payload);
        this.context.$tracking.trackEvent('document', {
            action: 'unarchive',
            entity_id: page.id,
        });
        if (this.context.$config.platform === 'mobile') return;
        const callback = () => {
            const tab = this.context.$tabs.createNewTabObject(
                page.id,
                TabType.DOCUMENT,
            );
            this.context.$tabs.openTab(tab);
        };
        this.context.$notification.show({
            component: () =>
                import('@/components/notifications/MiscNotification.vue'),
            bind: {
                displayText: 'Page Restored',
                action: NotificationActions.REDIRECT,
                callback,
                actionText: 'Show page',
            },
        });
    }

    deletePage(page: IDocument) {
        const backlinks = this.context.store.getters['document/backlinks'](
            page.id,
        );
        if (backlinks.length) {
            this.context.$vfm.show({
                component: () =>
                    import('@/components/modal/DocumentDeleteModal.vue'),
                bind: {
                    document: page,
                    backlinks,
                },
            });
            return;
        }
        this.context.$entities.page.deletePage(page.id);
        if (this.context.$config.platform === 'mobile') return;
        this.context.$tabs.closeTabsByEntityId(page.id);
        this.context.$notification.show({
            component: () =>
                import('@/components/notifications/MiscNotification.vue'),
            bind: {
                displayText: 'Page Deleted',
            },
        });
    }

    async pinPage(page: IDocument) {
        const pinnedDocuments = this.context.store.getters['document/pinned'];
        await this.context.store.dispatch('document/update', {
            id: page.id,
            pinned: true,
            pinOrder: pinnedDocuments.length * 500,
        });
        this.context.$tracking.trackEvent('document', {
            action: 'pin',
            entity_id: page.id,
        });
    }

    async unpinPage(page: IDocument) {
        await this.context.store.dispatch('document/update', {
            id: page.id,
            pinned: false,
            pinOrder: null,
        });
        this.context.$tracking.trackEvent('document', {
            action: 'unpin',
            entity_id: page.id,
        });
    }

    async createPageFromTemplate(page: IDocument) {
        const id = v4();
        const payload = {
            id,
            title: page.title,
            content: page.content,
            status: 'new',
            updatedAt: new Date(),
            createdAt: new Date(),
            projectId: null,
        };

        await this.context.store.dispatch('document/new', payload);
        await this.context.store.dispatch('document/update', payload);

        const tab = this.context.$tabs.createNewTabObject(id, TabType.DOCUMENT);
        this.context.$tabs.openTab(tab);
    }

    async duplicatePage(page: IDocument) {
        const duplicate = await this.context.store.dispatch(
            'document/duplicate',
            page.id,
        );

        const tab = this.context.$tabs.createNewTabObject(
            duplicate.id,
            TabType.DOCUMENT,
        );
        this.context.$tabs.openTab(tab);
        return duplicate.id;
    }

    async templateFromPage(page: IDocument) {
        const id = v4();

        const html = page.content
            .replace(/<vue-todo [^>]*uuid=['"][^>]+['"][^>]*><\/vue-todo>/g, '')
            .replace(/<inline-event id=['"][^>]+['"]><\/inline-event>/g, '');

        const payload = {
            id,
            title: page.title,
            content: html,
            status: 'new',
            updatedAt: new Date(),
            createdAt: new Date(),
            projectId: page.projectId,
            template: true,
        };

        await this.context.store.dispatch('document/new', payload);
        await this.context.store.dispatch('document/update', payload);

        this.context.$notification.show({
            component: () =>
                import('@/components/notifications/MiscNotification.vue'),
            bind: {
                callback: () => {
                    this.context.$entities.view.openTemplates();
                    this.context.$tracking.trackEventV2(TrackingType.TEMPLATE, {
                        action: TrackingAction.OPEN,
                        source: TrackingActionSource.NOTIFICATION,
                    });
                },
                action: NotificationActions.REDIRECT,
                displayText: 'Template saved',
                actionText: 'Go to templates',
            },
        });
    }

    deleteTemplate(page: IDocument) {
        this.context.$tabs.closeTabsByEntityId(page.id);
        this.context.$entities.page.deletePage(page.id);
    }

    sharePage(page: IDocument) {
        this.context.$vfm.show({
            component: () => import('@/components/modal/ShareModal.vue'),
            bind: {
                document: page,
            },
        });
    }

    async exportMarkdown(page: IDocument) {
        if (!page) return;

        const markdown = await this.context.$serviceRegistry.invoke<string[]>(
            ServiceKey.DATABASE,
            DatabaseServiceAction.CONVERT_TO_MD,
            {
                payload: {
                    contents: [page.content],
                    vaultId: this.context.store.getters['vault/active']?.id,
                },
                callerContext: 'utils/page.ts exportMarkdown',
            },
        );
        const blob = new Blob(markdown as BlobPart[], {
            type: 'text/plain;charset=utf-8',
        });
        saveAs(blob, `${page.title || 'Untitled'}.md`);

        this.context.$tracking.trackEventV2(TrackingType.PAGE, {
            action: TrackingAction.EXPORT_MARKDOWN,
        });
    }

    getWorkflowIcon(status: PageStatus | null | 'no status') {
        switch (status) {
            case PageStatus.DONE:
                return {
                    icon: InterfaceValidationCheckCircle,
                    color: '#59B17C',
                };
            case PageStatus.IN_PROGRESS:
                return {
                    icon: InProgressIcon,
                    color: '#4B7ED1',
                };
            case PageStatus.TODO:
                return {
                    icon: InterfaceGeometricCircleAlternate,
                    color: '#677489',
                };
            case null:
                return {
                    icon: InterfaceDeleteSquare,
                    color: '#949DAD',
                };
            default:
                return {
                    icon: InterfaceEditSelectAreaCircleDash,
                    color: '#949DAD',
                };
        }
    }

    parseRule = (def: any) => {
        const definition = cloneDeep(def);

        // Ah, fortunate are those who unearth this locus of code!
        // Revel in the task of its refinement and restoration.
        const property =
            definition.property === 'project'
                ? 'projectId'
                : definition.property;
        switch (definition.operation) {
            case 'eq':
                return (entity: any) => entity[property] === definition.value;
            case 'neq':
                return (entity: any) => entity[property] !== definition.value;
            case 'gt':
                return (entity: any) => entity[property] > definition.value;
            case 'gte':
                return (entity: any) => entity[property] >= definition.value;
            case 'lt':
                return (entity: any) => entity[property] < definition.value;
            case 'lte':
                return (entity: any) => entity[property] <= definition.value;
            case 'in':
                return (entity: any) =>
                    definition.value.includes(entity[property]);
            case 'notin':
                return (entity: any) =>
                    !definition.value.includes(entity[property]);
            case 'isSet':
            case 'has':
                return (entity: any) => {
                    const prop = entity[property];
                    if (!prop) return false;
                    return !isEmpty(prop);
                };
            case 'isNotSet':
                return (entity: any) => {
                    // Old logic was using isEmpty and !property, was fixed on 2024-01-02 by adam.
                    // Sadly views were already created with the old logic with isNotSet for archived property.
                    // As archived is always set to false the fix would break all views with isNotSet for archived, which is all views.
                    // Creating of new views was updated to use not equal true for archived.
                    if (property === 'archived') {
                        return entity.archived === false;
                    }

                    const prop = entity[property];
                    return prop === undefined || prop === null;
                };
            case 'containsAll':
                return (entity: any) => {
                    return (
                        definition.value.filter((val: any) => {
                            if (!(property in entity)) return false;
                            let prop = entity[property];
                            if (!Array.isArray(prop)) {
                                prop = [prop];
                            }
                            return prop.includes(val);
                        }).length == definition.value.length
                    );
                };
            case 'overlap':
                return (entity: any) => {
                    return (
                        definition.value.filter((val: any) => {
                            if (!(property in entity)) return false;
                            let prop = entity[property];
                            if (!Array.isArray(prop)) {
                                prop = [prop];
                            }
                            return prop.includes(val);
                        }).length > 0
                    );
                };
            case 'nooverlap':
                return (entity: any) => {
                    return (
                        definition.value.filter((val: any) => {
                            if (!(property in entity)) return false;
                            let prop = entity[property];
                            if (!Array.isArray(prop)) {
                                prop = [prop];
                            }
                            return prop.includes(val);
                        }).length <= 0
                    );
                };
            case 'lengt':
                return (entity: any) =>
                    entity[property].length > definition.value;
            case 'lenlt':
                return (entity: any) =>
                    entity[property].length < definition.value;
            case 'leneq':
                return (entity: any) =>
                    entity[property].length === definition.value;
            case 'isundefined':
                return (entity: any) =>
                    !(property in entity) || entity[property] === undefined;
            case 'isnull':
                return (entity: any) => entity[property] === null;
            default:
                return (entity: any) => true;
        }
    };

    definitionToFilter = (definition: any): any[] => {
        return (
            definition?.map((def: any) => {
                const isCombining = 'combine' in def;
                if (isCombining) {
                    const rules = this.definitionToFilter(def.definition);
                    return (entity: any) => {
                        const results = rules.map(rule => rule(entity));
                        switch (def.combine) {
                            case 'and':
                                return results.every(result => result);
                            case 'or':
                                return results.some(result => result);
                        }
                    };
                } else {
                    return this.parseRule(def);
                }
            }) ?? []
        );
    };

    constructEntityGetter(definition: any) {
        const filters = this.definitionToFilter(definition);
        return (entities: any[]) => {
            return entities.filter(entity => {
                return filters.every(rule => rule(entity));
            });
        };
    }

    getPagesByDefinition(definition: any) {
        const getter = this.constructEntityGetter(definition);
        const completePages = this.context.$entities.page
            .list()
            .map((page: IDocument) => ({
                ...page,
                ...this.context.$entities.page.getPostprocessingMap(page.id),
            }));
        return getter(completePages);
    }
}
