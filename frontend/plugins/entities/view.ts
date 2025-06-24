import { v4 } from 'uuid';
import isEmpty from 'lodash/isEmpty';
import cloneDeep from 'lodash/cloneDeep';
import { Project } from 'jira.js/out/version3/models';
import { IView, ViewPropertyDefinition } from '~/components/view/model';
import { EntityController } from '~/plugins/entities/controller';
import InProgressIcon from '~/components/icons/InProgressIcon.vue';
import InterfaceFileDouble from '~/components/streamline/InterfaceFileDouble.vue';
import InterfaceContentArchive from '~/components/streamline/InterfaceContentArchive.vue';
import {
    FolderType,
    GroupingOptions,
    PageListEntityType,
    PageStatus,
    SortingOptions,
    TabType,
    ViewType,
} from '~/constants';
import { ILabel, IFolder } from '~/@types';
import { IDocument } from '~/components/document/model';
import { throttle } from '~/helpers';
import { VirtualPageHeight } from '~/components/view/constants';
import InterfaceAlignLayers1 from '~/components/streamline/InterfaceAlignLayers1.vue';
import ViewOptionsDropdown from '~/components/view/ViewOptionsDropdown.vue';

export class ViewController extends EntityController<IView> {
    protected storeEntity = 'view';
    protected dbTable = 'views';

    viewIconResolver(icon: string) {
        switch (icon) {
            case 'InProgressIcon':
                return InProgressIcon;
            case 'InterfaceFileDouble':
                return InterfaceFileDouble;
            case 'InterfaceContentArchive':
                return InterfaceContentArchive;
            default:
                return InterfaceAlignLayers1;
        }
    }

    defaultViews(): IView[] {
        return [
            {
                id: ViewType.ACTIVE,
                isDefault: true,
                order: 0,
                type: ViewType.ACTIVE,
                name: 'Active',
                icon: 'InProgressIcon',
                color: '#577DCB',
                display: true,
                definition: [
                    {
                        combine: 'and',
                        definition: [
                            {
                                property: 'template',
                                operation: 'neq',
                                value: true,
                            },
                            {
                                property: 'dailyDoc',
                                operation: 'isNotSet',
                                value: null,
                            },
                            {
                                property: 'pageStatus',
                                operation: 'isSet',
                                value: null,
                            },
                            {
                                property: 'archived',
                                operation: 'neq',
                                value: true,
                            },
                        ],
                    },
                ],
                viewOptions: {
                    groupBy: GroupingOptions.PAGE_STATUS,
                    sortBy: SortingOptions.MANUAL,
                    sortDirection: 'desc',
                    collapsed: {},
                    showTasks: false,
                    hideCompletedTasks: false,
                    selectedDisplayProperties: [
                        'status',
                        'icon',
                        'project',
                        'tasks',
                        'date',
                        'updated',
                    ],
                },
            },
            {
                id: ViewType.ALL_PAGES,
                isDefault: true,
                order: 500,
                type: ViewType.ALL_PAGES,
                name: 'All Pages',
                icon: 'InterfaceFileDouble',
                color: '#9283ED',
                display: true,
                definition: [
                    {
                        combine: 'and',
                        definition: [
                            {
                                property: 'template',
                                operation: 'neq',
                                value: true,
                            },
                            {
                                property: 'archived',
                                operation: 'neq',
                                value: true,
                            },
                        ],
                    },
                ],
                viewOptions: {
                    sortBy: SortingOptions.UPDATED_AT,
                    sortDirection: 'desc',
                    collapsed: {},
                    showTasks: false,
                    hideCompletedTasks: false,
                    selectedDisplayProperties: [
                        'icon',
                        'tasks',
                        'project',
                        'date',
                        'breadcrumbs',
                        'updated',
                    ],
                },
            },
            {
                id: ViewType.ARCHIVE,
                isDefault: true,
                order: 1000,
                type: ViewType.ARCHIVE,
                name: 'Archive',
                icon: 'InterfaceContentArchive',
                color: '#626F83',
                display: true,
                definition: [
                    {
                        combine: 'and',
                        definition: [
                            {
                                property: 'template',
                                operation: 'neq',
                                value: true,
                            },
                            {
                                property: 'dailyDoc',
                                operation: 'isNotSet',
                                value: null,
                            },
                            {
                                property: 'archived',
                                operation: 'eq',
                                value: true,
                            },
                        ],
                    },
                ],
                viewOptions: {
                    sortBy: SortingOptions.UPDATED_AT,
                    sortDirection: 'desc',
                    collapsed: {},
                    showTasks: false,
                    hideCompletedTasks: false,
                    selectedDisplayProperties: ['icon', 'updated'],
                },
            },
        ];
    }

    getTemplatesView() {
        return {
            id: ViewType.TEMPLATES,
            isDefault: true,
            isEditable: false,
            order: 0,
            type: ViewType.TEMPLATES,
            name: 'Templates',
            icon: 'InterfaceEditSwatch',
            color: '#626F83',
            display: false,
            definition: [
                {
                    combine: 'and',
                    definition: [
                        {
                            property: 'template',
                            operation: 'eq',
                            value: true,
                        },
                        {
                            property: 'archived',
                            operation: 'neq',
                            value: true,
                        },
                    ],
                },
            ],
            viewOptions: {
                sortBy: SortingOptions.UPDATED_AT,
                sortDirection: 'desc',
                collapsed: {},
                showTasks: false,
                hideCompletedTasks: false,
                selectedDisplayProperties: ['icon', 'created'],
            },
        } as IView;
    }

    getViewById(id: string): IView | null {
        if (id === ViewType.TEMPLATES) return this.getTemplatesView();
        return this.byId(id);
    }

    getViewByType(type: ViewType) {
        return this.getViews().find((view: any) => view.type === type);
    }

    getViews() {
        const views = [...this.context.store.getters['view/list']];
        return views.filter((view: any) => {
            const overrideExists = views.find(
                (v: any) => v.type === view.type && v.isDefault === false,
            );
            return !(view.isDefault && overrideExists);
        });
    }

    getDisplayedViews() {
        return this.getViews().filter((view: any) => view?.display ?? true);
    }

    getSidebarCount(id: string) {
        const view = this.getViewById(id);
        const definition = this.getViewDefinition(id);
        if (!definition) return 0;
        if (definition?.length && view?.type === ViewType.ALL_PAGES) {
            const clonedDef = cloneDeep(definition);
            clonedDef[0].definition.push({
                property: 'dailyDoc',
                operation: 'isNotSet',
                value: null,
            });
            return (
                this.context.$utils.page.getPagesByDefinition(clonedDef)
                    .length ?? 0
            );
        }
        return (
            this.context.$utils.page.getPagesByDefinition(definition).length ??
            0
        );
    }

    getPagesByDefinition(definition: any) {
        return this.context.$utils.page.getPagesByDefinition(definition);
    }

    filterPagesByDefinition(pages: any[], definition: any) {
        const getter =
            this.context.$utils.page.constructEntityGetter(definition);
        return getter(pages);
    }

    getViewDefinition(id: string) {
        const view = this.getViewById(id);
        if (!view) return [];
        return view.definition;
    }

    getViewName(id: string) {
        const view = this.getViewById(id);

        if (!view) return 'Untitled View';

        switch (view.type) {
            case ViewType.ACTIVE:
                return 'Active';
            case ViewType.ALL_PAGES:
                return 'All Pages';
            case ViewType.ARCHIVE:
                return 'Archive';
            case ViewType.TEMPLATES:
                return 'Templates';
            default:
                return view.name || 'Untitled View';
        }
    }

    getDefaultViewIcon() {
        return 'InterfaceAlignLayers1';
    }

    isCustomView(id: string) {
        const view = this.getViewById(id);
        return view?.type === ViewType.CUSTOM;
    }

    getViewIcon(id: string) {
        const view = this.getViewById(id);
        if (!view || !view.icon) return null;
        return this.viewIconResolver(view.icon);
    }

    getViewEmoji(id: string) {
        const view = this.getViewById(id);
        if (!view || !view.emoji) return null;
        return view.emoji;
    }

    getViewColor(id: string) {
        const view = this.getViewById(id);
        if (!view || view.emoji) return null;
        return view.color ?? '#626F83';
    }

    isDefaultView(id: string) {
        const view = this.getViewById(id);
        return view?.isDefault || view?.type !== ViewType.CUSTOM;
    }

    isAllPagesView(id: string) {
        const view = this.getViewById(id);
        return view?.type === ViewType.ALL_PAGES;
    }

    isActiveView(id: string) {
        const view = this.getViewById(id);
        return view?.type === ViewType.ACTIVE;
    }

    isArchiveView(id: string) {
        const view = this.getViewById(id);
        return view?.type === ViewType.ARCHIVE;
    }

    isEditable(id: string) {
        const view = this.getViewById(id);
        if (!view) return true;
        return 'isEditable' in view ? view.isEditable : true;
    }

    editingView(id: string) {
        const view = this.getViewById(id);
        return view?.editing ?? false;
    }

    getViewOptions(id: string) {
        return (
            this.getViewById(id)?.viewOptions ?? {
                sortBy: SortingOptions.UPDATED_AT,
                sortDirection: 'desc',
                collapsed: {},
                showTasks: false,
                hideCompletedTasks: false,
                selectedDisplayProperties: [
                    'icon',
                    'tasks',
                    'date',
                    'breadcrumbs',
                    'updated',
                ],
            }
        );
    }

    updateViewOptions(id: string, value: any) {
        const view = this.getViewById(id);
        this.update({
            ...view,
            viewOptions: value,
        });
    }

    getDisplayPropertiesForViewType(type: ViewType) {
        if (type === ViewType.TEMPLATES) {
            return ['icon', 'created'];
        }
        if (type === ViewType.ARCHIVE) {
            return [
                'icon',
                'tasks',
                'clip',
                'links',
                'date',
                'updated',
                'created',
            ];
        }

        return [
            'status',
            'icon',
            'breadcrumbs',
            'project',
            'tasks',
            'clip',
            'links',
            'date',
            'updated',
            'created',
        ];
    }

    openTemplates() {
        const tab = this.context.$tabs.createNewTabObject(
            ViewType.TEMPLATES,
            TabType.VIEW,
        );
        this.context.$tabs.openTab(tab);
    }

    async update(view: Partial<IView>) {
        const defaultViews = this.defaultViews();
        const defaultView = defaultViews.find(
            (defaultView: any) => defaultView.id === view.id,
        );
        if (defaultView) {
            const id = v4();
            await this.context.store.dispatch('view/update', {
                ...view,
                id,
                isDefault: false,
            });
            const tab = this.context.$tabs.createNewTabObject(
                id,
                TabType.VIEW,
                { showControls: true },
            );
            await this.context.$tabs.openTab(tab);
            return;
        }
        await this.context.store.dispatch('view/update', view);
    }

    batchUpdate(views: Partial<IView>[]) {
        const defaultViews = this.defaultViews();
        const updatedViews = views.map((view: any) => {
            const defaultView = defaultViews.find(
                (defaultView: any) => defaultView.id === view.id,
            );
            if (defaultView) {
                return {
                    ...view,
                    id: v4(),
                    isDefault: false,
                };
            }
            return view;
        });
        this.context.store.dispatch('view/updateBatch', updatedViews);
    }

    async editView(id: string) {
        const tab = this.context.$tabs.createNewTabObject(id, TabType.VIEW);
        await this.update({
            id,
            editing: true,
        });
        await this.context.$tabs.openTab(tab);
    }

    async deleteView(view: string) {
        const newTab = this.context.$tabs.createNewTabObject(
            TabType.NEW,
            TabType.NEW,
        );
        await this.context.$tabs.openTab(newTab);
        await this.context.$tabs.closeTabsByEntityId(view);
        await this.context.store.dispatch('view/delete', view);
        this.context.$tracking.trackEvent('view', {
            action: 'delete',
        });
    }

    async newView(
        definition: ViewPropertyDefinition[] = [],
        viewOptions: any = {},
    ) {
        const id = v4();
        const view = {
            id,
            isDefault: false,
            editing: true,
            order: this.context.$utils.sidebar.getNewSidebarOrder(),
            type: ViewType.CUSTOM,
            name: '',
            icon: this.getDefaultViewIcon(),
            display: true,
            definition: [
                {
                    combine: 'and',
                    definition: [
                        {
                            property: 'template',
                            operation: 'neq',
                            value: true,
                        },
                        {
                            property: 'dailyDoc',
                            operation: 'isNotSet',
                            value: null,
                        },
                        {
                            property: 'archived',
                            operation: 'neq',
                            value: true,
                        },
                        ...definition,
                    ],
                },
            ],
            viewOptions: {
                groupBy: GroupingOptions.PAGE_STATUS,
                sortBy: SortingOptions.MANUAL,
                sortDirection: 'desc',
                collapsed: {},
                showTasks: false,
                hideCompletedTasks: false,
                selectedDisplayProperties: ['icon', 'updated'],
                ...viewOptions,
            },
        } as IView;
        await this.update(view);
        this.context.$tracking.trackEvent('view', {
            action: 'create',
        });
        return id;
    }

    createDefinitionControl(
        controlDefinition: {
            id: string;
            name: string;
            placeholderSuffix: string;
            property: string;
            operation: string;
        },
        definitions: any[],
        items: any[],
    ) {
        const isMultiSelect = ['in', 'notin', 'overlap'].includes(
            controlDefinition.operation,
        );
        return {
            name: 'Filter by ' + controlDefinition.name,
            items: items,
            searchPlaceholder: 'Filter ' + controlDefinition.placeholderSuffix,
            placeholder: 'Select ' + controlDefinition.placeholderSuffix,
            multiselect: isMultiSelect,
            selectedItems:
                this.selectedItemsById(
                    definitions,
                    controlDefinition.id,
                ) ?? (isMultiSelect ? [] : null),
        };
    }

    private selectedItemsById(definitions: any[], id: string) {
        return definitions.find(definition => definition.id === id)
            ?.value;
    }

    viewSelectOptions(): Record<string, any> {
        const labelsByType: Record<string, any[]> = {};

        const labels = this.context.$entities.label
            .list()
            .map((label: ILabel) => {
                if (typeof label === 'string' && label.includes(':')) {
                    const parts = label.split(':');
                    if(parts[0].length > 1 && parts[1].length > 1) {
                        const type = parts[0].slice(1);
                        const labelText = parts[1];

                        if (!labelsByType[type]) {
                            labelsByType[type] = [];
                        }
                        labelsByType[type].push({
                            id: label,
                            label: labelText,
                        });
                        return null; // Skip adding to the main labels array
                    }
                }
                return {
                    id: label,
                    label: label,
                };
            }).filter(Boolean); // Filter out null values

        const folders = this.context.$entities.folder
            .getFolders()
            .map((folder: IFolder) => ({
                id: folder.id,
                label: folder.name,
            }));

        const projects = this.context.$entities.project
            .getProjects()
            .map((project: IFolder) => ({
                id: project.id,
                label: project.name,
            }));


        // Формуємо результуючий об'єкт
        return {
            ...labelsByType,
            labels: labels,
            projectId: folders,
            project: projects,
        };
    }

    createUpdateWrapper(
        controlDefinition: Record<string, any>,
        definitions: any[],
    ) {
        return (value: any) => {
            const isNewProperty = !definitions.find(
                definition => definition.id && definition.id === controlDefinition.id,
            );
            return isNewProperty && !isEmpty(value)
                ? [
                      ...definitions,
                      {
                        id: controlDefinition.id,
                        name: controlDefinition.name,
                        property: controlDefinition.property,
                        operation: controlDefinition.operation,
                        value,
                      },
                  ]
                : definitions.map(definition => {
                      if (definition.name === controlDefinition.name) {
                          return {
                              id: controlDefinition.id,
                              name: controlDefinition.name,
                              property: controlDefinition.property,
                              operation: controlDefinition.operation,
                              value: value,
                          };
                      }
                      return definition;
                  });
        };
    }

    propertyViewDefinition(property: string):
        | {
              name: string;
              placeholderSuffix: string;
              property: string;
              allowedOperations: string[]; // TODO: use enum
              defaultOperation: string;
              items: { id: any; label: string }[];
          }
        | undefined {
        switch (property) {
            case 'tasks':
                return {
                    name: 'Tasks',
                    placeholderSuffix: 'tasks',
                    property,
                    allowedOperations: ['isSet', 'isNotSet'],
                    defaultOperation: 'isSet',
                    items: [],
                };
            case 'archived':
                return {
                    name: 'Archived',
                    placeholderSuffix: 'archived',
                    property,
                    allowedOperations: ['eq', 'neq'],
                    defaultOperation: 'eq',
                    items: [
                        {
                            id: true,
                            label: 'Archived',
                        },
                        {
                            id: false,
                            label: 'Not archived',
                        },
                    ],
                };
            case 'dailyDoc':
                return {
                    name: 'My Day',
                    placeholderSuffix: 'my day',
                    property,
                    allowedOperations: ['in', 'notin'],
                    defaultOperation: 'in',
                    items: [
                        {
                            id: true,
                            label: 'My Day',
                        },
                        {
                            id: false,
                            label: 'Not My Day',
                        },
                    ],
                };
            case 'template':
                return {
                    name: 'Template',
                    placeholderSuffix: 'template',
                    property,
                    allowedOperations: ['eq', 'neq'],
                    defaultOperation: 'eq',
                    items: [
                        {
                            id: true,
                            label: 'Template',
                        },
                        {
                            id: false,
                            label: 'Not Template',
                        },
                    ],
                };
            case 'projectId':
                return {
                    name: 'Folder',
                    placeholderSuffix: 'folder',
                    property,
                    allowedOperations: ['overlap', 'nooverlap'],
                    defaultOperation: 'overlap',
                    items: this.context.$entities.folder
                        .getFolders()
                        .map((folder: IFolder) => ({
                            id: folder.id,
                            label: folder.name.length
                                ? folder.name
                                : 'New Folder',
                        })),
                };
            case 'project':
                return {
                    name: 'Project',
                    placeholderSuffix: 'project',
                    property,
                    allowedOperations: ['overlap', 'nooverlap'],
                    defaultOperation: 'overlap',
                    items: this.context.$entities.project
                        .getProjects()
                        .map((project: IFolder) => ({
                            id: project.id,
                            label: project.name.length
                                ? project.name
                                : 'New Project',
                        })),
                };
            case 'labels':
                return {
                    name: 'Labels',
                    placeholderSuffix: 'labels',
                    property,
                    allowedOperations: ['overlap', 'nooverlap'],
                    defaultOperation: 'overlap',
                    items: this.context.store.getters['label/list'].map(
                        (label: ILabel) => ({
                            id: label,
                            label,
                        }),
                    ),
                };
        }
    }

    readableOperation(operation: string) {
        switch (operation) {
            case 'in':
            case 'isSet':
            case 'eq':
            case 'overlap':
                return 'is';
            case 'neq':
            case 'notin':
            case 'nooverlap':
            case 'isNotSet':
                return 'is not';
            default:
                return operation;
        }
    }

    getSectionName(sectionId: string, viewOptions: any) {
        const capitalized = (text: string) => {
            return text
                .split(' ')
                .map(word => {
                    return word[0].toUpperCase() + word.substring(1);
                })
                .join(' ');
        };
        if (viewOptions.groupBy === GroupingOptions.PAGE_STATUS) {
            if (!sectionId) {
                return 'No Status';
            }
            return capitalized(sectionId);
        }
        if (viewOptions.groupBy === GroupingOptions.FOLDER) {
            if (!sectionId) return 'No Folder';
            const folder = this.context.$entities.folder.byId(sectionId);
            if (!folder) return 'No Folder';

            const breadcrumbs =
                this.context.$entities.folder.getBreadcrumbs(sectionId);

            return `${breadcrumbs ? breadcrumbs + '/' : ''}${
                folder.name ? folder.name : 'New Folder'
            }`;
        }
        return sectionId;
    }

    sort(viewOptions: any) {
        const sortDirection = viewOptions.sortDirection ?? 'desc';
        const sortBy = viewOptions.sortBy ?? 'updatedAt';

        return (
            a: IDocument & Record<string, any>,
            b: IDocument & Record<string, any>,
        ) => {
            if (sortBy === SortingOptions.MANUAL) {
                return a.order - b.order;
            }
            if (sortBy === SortingOptions.TITLE) {
                if (sortDirection === 'desc')
                    return ('' + b.title).localeCompare(a.title);
                return ('' + a.title).localeCompare(b.title);
            }
            const aNum = new Date(a[sortBy]).getTime();
            const bNum = new Date(b[sortBy]).getTime();
            if (sortDirection === 'desc') return bNum - aNum;
            return aNum - bNum;
        };
    }

    sortPages(pages: IDocument[], viewOptions: any) {
        if (viewOptions.sortBy === SortingOptions.MANUAL) {
            const treeSortedDocuments =
                this.context.store.getters['document/treeSortedDocuments'];
            const pagesMap = pages.reduce((acc, val) => {
                acc.set(val.id, val);
                return acc;
            }, new Map<string, IDocument>());
            return treeSortedDocuments
                .map((doc: IDocument) => pagesMap.get(doc.id))
                .filter((document: IDocument | undefined) => !!document);
        }
        return [...pages].sort(this.sort(viewOptions));
    }

    pagesForSection(sectionId: string, pages: IDocument[], viewOptions: any) {
        if (viewOptions.groupBy === GroupingOptions.PAGE_STATUS) {
            if (!sectionId) {
                return this.sortPages(pages, viewOptions).filter(
                    (page: any) => !page.pageStatus,
                );
            }
            return this.sortPages(pages, viewOptions).filter(
                (page: any) => page.pageStatus === sectionId,
            );
        }
        if (viewOptions.groupBy === GroupingOptions.FOLDER) {
            if (!sectionId) {
                return this.sortPages(pages, viewOptions).filter(
                    (page: any) => !page.projectId,
                );
            }
            return this.sortPages(pages, viewOptions).filter(
                (page: any) => page.projectId === sectionId,
            );
        }
        return this.sortPages(pages, viewOptions);
    }

    getSections(viewOptions: any, pageListType: ViewType | FolderType) {
        if (viewOptions.groupBy === GroupingOptions.PAGE_STATUS) {
            if (pageListType !== ViewType.ACTIVE) {
                return [...Object.values(PageStatus), null];
            }
            return Object.values(PageStatus);
        }
        if (viewOptions.groupBy === GroupingOptions.FOLDER) {
            const folders = this.context.$entities.folder
                .getFlatTree()
                .filter((node: any) => !!node.children)
                .map(({ data }: { data: any }) => data.id);
            return [...folders, null];
        }
        return [];
    }

    getFlattenedPagesMobile(
        pages: IDocument[],
        viewOptions: any,
        pageListType: ViewType | FolderType,
    ) {
        const sections = this.getSections(viewOptions, pageListType);
        const itemHeight = VirtualPageHeight.MOBILE_PAGE;
        const statusHeight = VirtualPageHeight.MOBILE_STATUS;
        const adderHeight = VirtualPageHeight.MOBILE_ADDER;
        const spacerHeight = VirtualPageHeight.MOBILE_SPACER;

        const getHeight = (item: any) => {
            if (item.type === PageListEntityType.SECTION_HEADER)
                return statusHeight;
            if (item.type === PageListEntityType.PAGE_ADDER) return adderHeight;
            if (item.spacer) return spacerHeight;
            return itemHeight;
        };

        const flatStructure: any[] = [{ spacer: true }];

        if (
            viewOptions.groupBy &&
            viewOptions.groupBy !== GroupingOptions.NONE
        ) {
            for (const section of sections) {
                const pagesForSection = this.pagesForSection(
                    section,
                    pages,
                    viewOptions,
                );
                flatStructure.push({
                    id: section,
                    type: PageListEntityType.SECTION_HEADER,
                    groupId: section,
                    name: this.getSectionName(section, viewOptions),
                    count: this.pagesForSection(section, pages, viewOptions)
                        .length,
                });
                for (const page of pagesForSection) {
                    flatStructure.push({
                        id: page.id,
                        type: PageListEntityType.PAGE,
                        page,
                    });
                }
                flatStructure.push({
                    id: `${section}-adder`,
                    type: PageListEntityType.PAGE_ADDER,
                    groupId: section,
                });
            }
        } else {
            for (const page of this.sortPages(pages, viewOptions)) {
                flatStructure.push({
                    id: page.id,
                    type: 'page',
                    page,
                    status: null,
                    isSelectable: true,
                });
            }
        }
        let currentHeight = 0;
        const output = [];
        for (const item of flatStructure) {
            const height = getHeight(item);
            output.push({
                ...item,
                height,
                y: currentHeight,
            });
            currentHeight += height;
        }
        return output;
    }
}
