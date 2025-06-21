<template>
    <div ref="pageListContent" class="page-list">
        <VirtualCollection
            ref="virtualCollection"
            :cell-size-and-position-getter="cellSizeAndPositionGetterList"
            :collection="flatPageListData"
            :width="listWidth"
            :height="retrieveHeight"
            :header-slot-height="0"
            class="page-list__wrapper tab-content-gutter"
            @scroll="handleScroll"
        >
            <template #header>
                <div v-if="isDragging && !isManualSort">
                    <div
                        v-for="dropArea in dropAreas"
                        :key="dropArea.type"
                        :style="{
                            top: dropArea.start + 20 + 'px',
                            left: '0px',
                            height: dropArea.end - dropArea.start + 'px',
                        }"
                        class="drop-area"
                        @mouseenter="handleMouseEnter"
                        @mouseleave="handleMouseLeave"
                        @mouseup.prevent="handleDropAreaDrop(dropArea.type)"
                    ></div>
                </div>
                <div v-if="shouldShowPill" class="order-pill">
                    <p>Pages are sorted by: {{ sortingOption }}</p>
                </div>
            </template>
            <template #cell="{ data }">
                <PageListHeaderComponent
                    v-if="data.type === PageListEntityType.HEADER"
                    :count="data.count"
                    :sort-by-message="sortByMessage"
                >
                    <template #title>
                        <component
                            :is="$utils.pageList.pageListHeader(pageListType)"
                        />
                    </template>
                    <template
                        v-if="$entities.view.isEditable(entityId)"
                        #controls
                    >
                        <div class="page-list__header-controls">
                            <PageListControlsWrapper
                                :definition="activeFilters"
                                :show-filter-options="!$entities.project.isProject(entityId)"
                                :show-group-options="
                                    !$entities.view.isArchiveView(entityId)
                                "
                                @update="handleFiltersUpdate"
                                @update-display="updateViewOptions"
                            />
                        </div>
                    </template>
                    <template v-if="hasInteractiveFilters" #banners>
                        <div class="page-list__filters">
                            <div class="page-list__filters__definition">
                                <DefinitionBanner
                                    v-for="definition in interactiveFilters"
                                    :key="definition.name"
                                    :definition="definition"
                                    @update="handleBannerUpdate"
                                    @delete="handleRemoveFilter(definition)"
                                />
                            </div>
                            <div
                                v-if="$entities.view.isAllPagesView(entityId)"
                                class="page-list__filters__actions"
                            >
                                <CButton
                                    type="secondary"
                                    size="small"
                                    tabindex="-1"
                                    @click="saveAsView"
                                >
                                    Create View
                                </CButton>
                            </div>
                        </div>
                    </template>
                </PageListHeaderComponent>
                <PageSectionHeader
                    v-else-if="data.type === PageListEntityType.SECTION_HEADER"
                    :section-id="data.id"
                    :section-name="data.name"
                    :count="data.count"
                    :collapsed="data.collapsed"
                    :focused="data.id === selectedId"
                    :group-by="groupBy"
                    @collapse="handleCollapse"
                    @mouseenter.native="
                        handleSectionHeaderMouseOver(data, true)
                    "
                    @mouseleave.native="
                        handleSectionHeaderMouseOver(data, false)
                    "
                />
                <div v-else-if="data.type === PageListEntityType.PAGE_ADDER">
                    <div
                        v-if="isDragging && isManualSort"
                        class="drag-divider top"
                        @mouseenter="handleMouseEnter"
                        @mouseleave="handleMouseLeave"
                        @mouseup.prevent="handleAdderDrop(data)"
                    >
                        <div class="drag-divider__line"></div>
                    </div>
                    <PageAdder
                        :ref="`adder-${data.id}`"
                        :focused="data.id === selectedId && !isDragging"
                        :adder-focused="adderFocused === data.id"
                        :group-by="groupBy"
                        :group-id="data.groupId"
                        :dragging="isDragging"
                        @focused="adderFocused = data.id"
                    />
                </div>
                <PageListTaskComponent
                    v-else-if="data.type === PageListEntityType.TASK"
                    :key="data.id"
                    :ref="`task-${data.id}`"
                    :focused="data.id === selectedId"
                    :task-id="data.id"
                    :source="source"
                />
                <div v-else>
                    <div
                        v-if="isDragging && isManualSort"
                        class="drag-divider top"
                        @mouseup.prevent="handlePageDrop(data)"
                        @mouseenter="handleMouseEnter"
                        @mouseleave="handleMouseLeave"
                    >
                        <div class="drag-divider__line"></div>
                    </div>
                    <PageRow
                        :ref="`row-${data.id}`"
                        :focused="data.id === selectedId && !isDragging"
                        :document="data.page"
                        :show-status="true"
                        :dragging="
                            isDragging && data.id === dragData.data.pageId
                        "
                        @page:dragstart="handleDragStart"
                    />
                </div>
            </template>
        </VirtualCollection>
    </div>
</template>

<script lang="ts">
import { Component, Inject, Prop, Vue, Watch } from 'vue-property-decorator';
import isEmpty from 'lodash/isEmpty';
import { animate } from 'motion';
import {
    GroupingOptions,
    PageListEntityType,
    PageListType,
    PageStatus,
    SortingOptions,
    TabType,
    ViewType,
} from '~/constants';
import { IDocument } from '~/components/document/model';
import PageRow from '~/components/page-list/list/PageRow.vue';
import {
    ViewPageOrderMultiplier,
    VirtualPageHeight,
} from '~/components/view/constants';
import { throttle } from '~/helpers';
import PageListHeaderComponent from '~/components/page-list/list/PageListHeaderComponent.vue';
import PageAdder from '~/components/page-list/list/PageAdder.vue';
import { PageListSymbols, TabSymbols } from '~/constants/symbols';
import PageListControlsWrapper from '~/components/page-list/list/header/PageListControlsWrapper.vue';
import PageListTaskComponent from '~/components/page-list/list/PageListTaskComponent.vue';
import PageListOptionsWrapper from '~/components/page-list/list/header/PageListOptionsWrapper.vue';
import PageSectionHeader from '~/components/page-list/list/PageSectionHeader.vue';
import DefinitionBanner from '~/components/view/controls/filter/DefinitionBanner.vue';
import { IView, ViewPropertyDefinition } from '~/components/view/model';
import CButton from '~/components/CButton.vue';
import { ThemeOptions } from '~/helpers/date';
import {
    TrackingAction,
    TrackingActionSource,
    TrackingType,
} from '~/@types/tracking';
import {
    PageListHeader,
    PageListPage,
    PageListPageAdder,
    PageListSectionHeader,
    PageListTask,
} from '~/components/page-list/model';

@Component({
    name: 'PageList',
    computed: {
        PageListEntityType() {
            return PageListEntityType;
        },
    },
    components: {
        CButton,
        DefinitionBanner,
        PageSectionHeader,
        PageListOptionsWrapper,
        PageListTaskComponent,
        PageListControlsWrapper,
        PageAdder,
        PageListHeaderComponent,
        PageRow,
    },
})
export default class PageList extends Vue {
    @Prop({ required: true })
    pages!: IDocument[];

    @Prop({ required: false, default: false })
    emptyFilterState!: boolean;

    @Prop({ default: false })
    drag!: boolean;

    @Inject(PageListSymbols.TYPE)
    pageListType!: PageListType;

    @Inject({ from: TabSymbols.TAB_ID, default: null })
    tabId!: string | null;

    @Inject(TabSymbols.ENTITY_ID)
    entityId!: string;

    @Inject(TabSymbols.UPDATE_TAB_DATA)
    updateTabData!: (data: Record<string, any>) => void;

    @Inject(TabSymbols.SET_SCROLL_POSITION)
    setScrollPosition!: (position: number) => void;

    @Inject(TabSymbols.GET_SCROLL_POSITION)
    getScrollPosition!: () => number;

    $refs!: {
        pageListContent: HTMLElement;
        virtualCollection: any;
    } & Record<string, HTMLElement>;

    width: number = 0;
    throttledByFps: any = throttle(requestAnimationFrame);
    pageListResizeObserver: any;
    listWidth: number = 0;
    height: number = 0;
    selectionIndex = 0;
    selectedId = '';
    isDragging: boolean = false;
    adderFocused: string = '';
    sectionCollapseTimeout: any = null;
    shouldDragScroll: any = false;
    scrollSpeed: any = 0;
    dragThrottleByFps = throttle(requestAnimationFrame);
    groupBoundaries = {
        [PageStatus.TODO]: { start: 0, end: 0 },
        [PageStatus.IN_PROGRESS]: { start: 0, end: 0 },
        [PageStatus.DONE]: { start: 0, end: 0 },
        null: { start: 0, end: 0 },
    };

    get tabData() {
        if (!this.tabId) return {};
        return this.$tabs.getTabData(this.tabId);
    }

    get isActive() {
        return this.tabId === this.$utils.navigation.activeTabId;
    }

    get dropAreas() {
        return Object.entries(this.groupBoundaries).map(
            ([key, { start, end }]) => {
                return {
                    type: key,
                    start,
                    end,
                };
            },
        );
    }

    get columnSize() {
        return 1;
    }

    get shouldShowPill() {
        return this.isDragging && !this.isManualSort;
    }

    get pageListViewOptions() {
        return this.$utils.pageList.getPageListViewOptions(
            this.pageListType,
            this.entityId,
        );
    }

    get isManualSort() {
        return this.pageListViewOptions.sortBy === SortingOptions.MANUAL;
    }

    get sortingOption() {
        const options = {
            manual: 'Manual',
            title: 'Title',
            updatedAt: 'Updated At',
            createdAt: 'Created At',
        } as any;
        return options[this.pageListViewOptions.sortBy as any] ?? 'Created At';
    }

    get sortByMessage() {
        if (this.isManualSort) return '';
        return `Sort by ${this.sortingOption}`;
    }

    get hasInteractiveFilters() {
        return this.interactiveFilters && this.interactiveFilters.length > 0;
    }

    get interactiveFilters() {
        const hiddenFilters = ['dailyDoc'];
        return (
            this.tabData?.filterDefinition?.filter(
                (filter: any) => !hiddenFilters.includes(filter.property),
            ) ?? []
        );
    }

    get activeFilters() {
        return this.tabData?.filterDefinition;
    }

    get source() {
        if (!this.tabId) return null;
        return this.$tracking.resolveSourceFromTab(this.tabId);
    }

    get dragData() {
        return this.$utils.pageList.getDragData();
    }

    get retrieveHeight() {
        return this.height;
    }

    get collapsedSections() {
        return this.tabData.collapsed ?? {};
    }

    get filteredPages() {
        return this.sortDocuments(this.pages);
    }

    get flatPageListData() {
        const data = this.flattenedPageList ?? [];

        return data.map((data: any, index: number) => {
            data.index = index;
            return { data };
        });
    }

    get groupBy() {
        return this.pageListViewOptions.groupBy ?? GroupingOptions.NONE;
    }

    get sections() {
        if (this.groupBy === GroupingOptions.PAGE_STATUS) {
            if (this.pageListType === PageListType.VIEW) {
                const view = this.$entities.view.getViewById(this.entityId);
                if (!view) return Object.values(PageStatus);
                if (view.type !== ViewType.ACTIVE) {
                    return [...Object.values(PageStatus), null];
                }
            }
            if (this.pageListType === PageListType.PROJECT) {
                return [...Object.values(PageStatus), null];
            }
            return Object.values(PageStatus);
        }
        if (this.groupBy === GroupingOptions.FOLDER) {
            const folders = this.$entities.folder
                .getFlatTree()
                .filter((node: any) => !!node.children)
                .map(({ data }: { data: any }) => data.id);
            return [...folders, null];
        }
        return [];
    }

    get entity() {
        return this.$utils.pageList.getPageListEntity(
            this.entityId,
            this.pageListType,
        );
    }

    get flattenedPageList(): (
        | PageListPage
        | PageListTask
        | PageListSectionHeader
        | PageListPageAdder
        | PageListHeader
    )[] {
        const itemHeight = VirtualPageHeight.PAGE;
        const statusHeight = VirtualPageHeight.STATUS;
        const adderHeight = VirtualPageHeight.ADDER;
        const taskHeight = VirtualPageHeight.TASK;

        // @ts-ignore
        const editing = this.entity?.editing ?? false;

        const header = {
            id: 'header',
            type: PageListEntityType.HEADER,
            count: 0,
            editing,
        } as PageListHeader;

        const getPageHeaderHeight = () => {
            return editing
                ? VirtualPageHeight.EDIT_HEADER
                : VirtualPageHeight.HEADER +
                      (this.hasInteractiveFilters
                          ? VirtualPageHeight.BANNERS
                          : 0);
        };

        const getHeight = (item: any) => {
            if (item.type === PageListEntityType.HEADER)
                return getPageHeaderHeight();
            if (item.type === PageListEntityType.SECTION_HEADER)
                return statusHeight;
            if (item.type === PageListEntityType.PAGE_ADDER) return adderHeight;
            if (item.type === PageListEntityType.TASK) {
                return taskHeight;
            }
            return itemHeight;
        };

        const collapsed = this.collapsedSections;
        const flatStructure: any[] = [header];

        const showTasks = this.pageListViewOptions.showTasks ?? false;
        const hideCompletedTasks =
            this.pageListViewOptions.hideCompletedTasks ?? false;

        if (this.groupBy !== GroupingOptions.NONE) {
            for (const section of this.sections) {
                const pagesForSection = this.pagesForSection(section!);
                if (
                    this.interactiveFilters.length &&
                    pagesForSection.length === 0
                )
                    continue;

                const sectionCollapsed = collapsed[section];
                flatStructure.push({
                    id: section,
                    type: PageListEntityType.SECTION_HEADER,
                    isSelectable: true,
                    groupId: section,
                    name: this.getSectionName(section!),
                    collapsed: sectionCollapsed,
                    count: this.pagesForSection(section!).length,
                } as PageListSectionHeader);

                const sortedPages = this.$utils.pageList.sortPagesByOrder(
                    pagesForSection,
                    this.entityId,
                    this.pageListType,
                );
                header.count += pagesForSection.length;
                if (sectionCollapsed) continue;
                for (let i = 0; i < sortedPages.length; i++) {
                    const orderEntry = sortedPages[i];
                    const page = pagesForSection[orderEntry.index];
                    const tasksOnPage = page.tasks;
                    flatStructure.push({
                        id: page.id,
                        type: PageListEntityType.PAGE,
                        order: orderEntry.order,
                        isSelectable: true,
                        groupId: section,
                        page,
                    } as PageListPage);

                    if (!showTasks) {
                        continue;
                    }
                    if (tasksOnPage && tasksOnPage.length) {
                        for (const task of tasksOnPage) {
                            const taskExists =
                                this.$store.getters['tasks/byId'](task);
                            if (
                                !taskExists ||
                                (hideCompletedTasks && taskExists.completed)
                            )
                                continue;
                            flatStructure.push({
                                id: task,
                                type: PageListEntityType.TASK,
                                isSelectable: true,
                            } as PageListTask);
                        }
                    }
                }

                flatStructure.push({
                    id: `${section}-adder`,
                    type: PageListEntityType.PAGE_ADDER,
                    order:
                        flatStructure[flatStructure.length - 1].order +
                        ViewPageOrderMultiplier,
                    isSelectable: true,
                    groupId: section,
                } as PageListPageAdder);
            }
        } else {
            const sortedPages = this.$utils.pageList.sortPagesByOrder(
                this.filteredPages,
                this.entityId,
                this.pageListType,
            );
            for (let i = 0; i < this.filteredPages.length; i++) {
                const orderEntry = sortedPages[i];
                const page = this.filteredPages[orderEntry.index];
                const tasksOnPage = page.tasks;
                flatStructure.push({
                    id: page.id,
                    type: PageListEntityType.PAGE,
                    order: orderEntry.order,
                    isSelectable: true,
                    groupId: null,
                    page,
                } as PageListPage);
                header.count++;
                if (!showTasks) continue;
                if (tasksOnPage && tasksOnPage.length) {
                    for (const task of tasksOnPage) {
                        const taskExists =
                            this.$store.getters['tasks/byId'](task);
                        if (
                            !taskExists ||
                            (hideCompletedTasks && taskExists.completed)
                        )
                            continue;
                        flatStructure.push({
                            id: task,
                            type: PageListEntityType.TASK,
                            isSelectable: true,
                        } as PageListTask);
                    }
                }
            }
            if (
                (this.pageListType === PageListType.PROJECT ||
                    ![ViewType.ARCHIVE, ViewType.TEMPLATES].includes(
                        (this.entity as IView)?.type,
                    )) &&
                !this.emptyFilterState
            ) {
                flatStructure.push({
                    id: `global-adder`,
                    type: PageListEntityType.PAGE_ADDER,
                    order:
                        flatStructure[flatStructure.length - 1].order +
                        ViewPageOrderMultiplier,
                    isSelectable: true,
                    groupId: null,
                } as PageListPageAdder);
            }
        }

        let currentHeight = 0;
        const dataWithHeight = flatStructure.map((item: any) => {
            const height = getHeight(item);
            const output = {
                height,
                y: currentHeight,
            };
            currentHeight += height;
            return {
                ...item,
                ...output,
            };
        });

        if (this.groupBy === GroupingOptions.PAGE_STATUS) {
            this.computeGroupBoundaries(dataWithHeight);
        }
        return dataWithHeight;
    }

    @Watch('dragData')
    handleDragDataChange(val: any) {
        if (!val) {
            this.isDragging = false;
        }
    }

    @Watch('isActive')
    handleIsActive(value: boolean) {
        if (value) {
            this.$nextTick(() => {
                this.registerShortcuts();
            });
        } else {
            this.removeShortcuts();
        }
    }

    handleBannerUpdate(definition: any) {
        this.updateTabData({
            filterDefinition: this.activeFilters.map((def: any) => {
                if (def.property === definition.property) {
                    return definition;
                }
                return def;
            }),
        });
    }

    async saveAsView() {
        const id = await this.$entities.view.newView(
            this.interactiveFilters,
            this.pageListViewOptions,
        );
        this.clearFilters();
        const tab = this.$tabs.createNewTabObject(id, TabType.VIEW);
        await this.$tabs.openTab(tab);
        this.$tracking.trackEventV2(TrackingType.CUSTOM_VIEW, {
            action: TrackingAction.CREATE,
            source: TrackingActionSource.ALL_PAGES,
            entityId: id,
        });
    }

    clearFilters() {
        const hiddenFilters = ['dailyDoc'];
        const filters = this.tabData.filterDefinition.filter((filter: any) =>
            hiddenFilters.includes(filter.property),
        );
        this.updateTabData({
            filterDefinition: filters,
        });
    }

    handleRemoveFilter(definition: any) {
        this.updateTabData({
            filterDefinition: this.activeFilters.filter(
                (def: any) => def.property !== definition.property,
            ),
        });
    }

    handleFiltersUpdate(definition: any) {
        this.updateTabData({
            filterDefinition: definition.filter(
                (def: ViewPropertyDefinition) =>
                    !Array.isArray(def.value) || !isEmpty(def.value),
            ),
        });
    }

    computeGroupBoundaries(dataWithHeight: any[]) {
        const offset = this.$store.getters['tabs/singleTabOpen'] ? 0 : 32;
        const collapsed: Record<string, boolean> = {};
        for (const data of dataWithHeight) {
            const section =
                data.groupId === null ? 'null' : (data.groupId as PageStatus);
            if (data.type === PageListEntityType.SECTION_HEADER && section) {
                this.groupBoundaries[section].start = data.y + offset;
                if (data.collapsed) {
                    collapsed[section] = true;
                    this.groupBoundaries[section].end =
                        data.y + data.height + offset;
                }
            }
            if (
                data.type !== PageListEntityType.SECTION_HEADER &&
                section &&
                !collapsed[section]
            ) {
                this.groupBoundaries[section].end =
                    data.y + data.height + offset;
            }
        }
    }

    sort() {
        const sortDirection = this.pageListViewOptions.sortDirection ?? 'desc';
        const sortBy = this.pageListViewOptions.sortBy ?? 'updatedAt';

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

    pagesForSection(id: string) {
        if (this.groupBy === GroupingOptions.PAGE_STATUS) {
            if (!id) {
                return this.filteredPages.filter(
                    (page: any) => !page.pageStatus,
                );
            }
            return this.filteredPages.filter(
                (page: any) => page.pageStatus === id,
            );
        }
        if (this.groupBy === GroupingOptions.FOLDER) {
            if (!id) {
                return this.filteredPages.filter(
                    (page: any) => !page.projectId,
                );
            }
            return this.filteredPages.filter(
                (page: any) => page.projectId === id,
            );
        }
        return this.filteredPages;
    }

    handleSectionHeaderMouseOver(data: any, enter: boolean) {
        if (!enter && this.sectionCollapseTimeout) {
            clearTimeout(this.sectionCollapseTimeout);
            this.sectionCollapseTimeout = null;
            return;
        }
        if (this.isDragging && this.isManualSort && data.collapsed && enter) {
            this.sectionCollapseTimeout = setTimeout(() => {
                this.handleCollapse(data.id);
                this.sectionCollapseTimeout = null;
            }, 1_000);
        }
    }

    getSectionName(id: string) {
        const capitalized = (text: string) => {
            return text
                .split(' ')
                .map(word => {
                    return word[0].toUpperCase() + word.substring(1);
                })
                .join(' ');
        };
        if (this.groupBy === GroupingOptions.PAGE_STATUS) {
            if (!id) {
                return 'No Status';
            }
            return capitalized(id);
        }
        if (this.groupBy === GroupingOptions.FOLDER) {
            if (!id) return 'No Folder';

            const folder = this.$entities.folder.byId(id);
            if (!folder) return 'No Folder';
            const breadcrumbs = this.$entities.folder.getBreadcrumbs(id);

            return `${breadcrumbs ? breadcrumbs + '/' : ''}${
                folder.name ? folder.name : 'New Folder'
            }`;
        }
        return id;
    }

    sortDocuments(documents: IDocument[]) {
        if (this.pageListViewOptions.sortBy === SortingOptions.MANUAL) {
            const treeSortedDocuments =
                this.$store.getters['document/treeSortedDocuments'];
            const documentsMap = documents.reduce((acc, val) => {
                acc.set(val.id, val);
                return acc;
            }, new Map<string, IDocument>());
            return treeSortedDocuments
                .map((doc: IDocument) => documentsMap.get(doc.id))
                .filter((document: IDocument | undefined) => !!document);
        }
        return [...documents].sort(this.sort());
    }

    updateViewOptions(data: any) {
        const currentViewOptions = this.pageListViewOptions;
        const updatedViewOptions = { ...currentViewOptions, ...data };
        this.$utils.pageList.updatePageListViewOptions(
            this.pageListType,
            this.entityId,
            updatedViewOptions,
        );
        if (!this.tabId) return;
        const type = this.$tracking.resolveTypeFromTab(this.tabId);
        if (!type) return;
        this.$tracking.trackDropdownEvent(type, data, currentViewOptions);
    }

    handleCollapse(id: string) {
        const collapsed = this.tabData.collapsed[id] ?? false;
        this.updateTabData({
            collapsed: {
                ...this.tabData.collapsed,
                [id]: !collapsed,
            },
        });
    }

    cellSizeAndPositionGetterList(item: any, index: number) {
        const itemHeight = VirtualPageHeight.PAGE;
        const width = this.width;

        const gutter = this.$utils.isMobile ? 0 : 46;

        return {
            width: width - gutter,
            height: item.data.height ?? itemHeight,
            x: 0,
            y: item.data.y ?? index * itemHeight,
            style: {
                'z-index': 0,
            },
        };
    }

    resizeListener() {
        return new Promise<void>((resolve, _reject) => {
            this.throttledByFps(() => {
                if (!this.$refs.pageListContent) return;
                const pageListWidth = this.$refs.pageListContent.offsetWidth;
                this.width = pageListWidth;
                this.listWidth = pageListWidth;
                this.height = this.$refs.pageListContent.offsetHeight;
                resolve();
            });
        });
    }

    scrollTo(top: number, behavior: any) {
        this.$refs.pageListContent.firstElementChild?.scrollTo({
            top,
            behavior,
        });
    }

    isInViewport() {
        const item = this.flatPageListData[this.selectionIndex].data;
        const scrollOffset =
            this.$refs.pageListContent.firstElementChild!.scrollTop;
        const elementHeight = this.$refs.pageListContent.scrollHeight;
        const itemEnd = item.y + 28;

        const isInside = (y: number): boolean => {
            return y < elementHeight + scrollOffset && y > scrollOffset;
        };

        return isInside(item.y) && isInside(itemEnd);
    }

    scroll(offset: number) {
        if (this.isInViewport()) {
            return;
        }
        const item = this.flatPageListData[this.selectionIndex].data;
        if (!item) return;
        const elementHeight = this.$refs.pageListContent.scrollHeight;
        if (this.selectionIndex < 3) {
            this.scrollTo(0, 'instant');
            return;
        }

        if (this.selectionIndex === this.flatPageListData.length - 1) {
            this.scrollTo(item.y + 64, 'instant');
            return;
        }
        this.scrollTo(item.y - elementHeight * offset + 32 * offset, 'instant');
    }

    getNextViableIndex(index: number, bias: number, group: boolean = false) {
        let validIndex = index;
        const currentIdExists = this.flatPageListData.some(
            ({ data }) => data?.id === this.selectedId,
        );
        const isValidIndex = (i: number) => {
            return i >= 0 && i < this.flatPageListData.length;
        };
        if (index === this.flatPageListData.length) {
            return this.flatPageListData.length - 1;
        }

        if (
            !currentIdExists &&
            isValidIndex(index) &&
            this.flatPageListData[validIndex].data.isSelectable
        ) {
            return index;
        }
        if (validIndex >= this.flatPageListData.length) {
            validIndex = this.flatPageListData.length - 1;
            if (this.flatPageListData[validIndex].data.isSelectable)
                return validIndex;
        }

        const currentGroup = this.flatPageListData[validIndex].data.groupId;

        while (isValidIndex(validIndex)) {
            validIndex += bias;
            if (!isValidIndex(validIndex)) break;
            const entity = this.flatPageListData[validIndex].data;
            if (
                entity.isSelectable &&
                (!group ||
                    (entity.type === PageListEntityType.SECTION_HEADER &&
                        currentGroup !== entity.groupId))
            )
                return validIndex;
        }

        return index;
    }

    handleArrows(move: string, group = false) {
        this.$dropdown.hide('page-row-preview');
        let offset = 0;
        switch (move) {
            case 'ArrowUp':
                this.selectionIndex = this.getNextViableIndex(
                    this.selectionIndex,
                    -this.columnSize,
                    group,
                );
                offset = 0;
                break;
            case 'ArrowDown':
                this.selectionIndex = this.getNextViableIndex(
                    this.selectionIndex,
                    this.columnSize,
                    group,
                );
                offset = 1;
                break;
        }
        const data = this.flatPageListData[this.selectionIndex]?.data;
        if (!data) return;
        this.selectedId = data.id;
        this.scroll(offset);
    }

    handleMouseEnter($event: MouseEvent) {
        const element = $event.target as HTMLElement;
        if (
            element.classList.contains('drop-area') ||
            element.classList.contains('drag-divider')
        ) {
            element.classList.add('active');
        }
    }

    handleMouseLeave($event: MouseEvent) {
        const element = $event.target as HTMLElement;
        if (
            element.classList.contains('drop-area') ||
            element.classList.contains('drag-divider')
        ) {
            element.classList.remove('active');
        }
    }

    handleScroll(e: any) {
        this.setScrollPosition(e.scrollTop);
    }

    setInitialScrollPosition() {
        const scrollPosition = this.getScrollPosition();
        if (scrollPosition) {
            this.$refs.virtualCollection!.$el!.scrollTop = scrollPosition;
        }
    }

    handleDragStart(e: any) {
        if (!this.drag) return;
        this.isDragging = true;
        this.registerDragScrollListeners();
        this.selectedId = e.pageId;
        this.$utils.pageList.startDrag(this.entityId, e);
    }

    handleDropAreaDrop(status: PageStatus | string) {
        if (
            !Object.values(PageStatus).includes(status as PageStatus) &&
            status !== 'null'
        )
            return;
        this.handleDrop(null, (status === 'null' ? null : status) as any);
    }

    handlePageDrop(props: any) {
        this.handleDrop(props, props.page.pageStatus);
    }

    handleAdderDrop(props: any) {
        this.handleDrop(props, props.groupId);
    }

    handleDrop(dropAnchor: any, status: PageStatus) {
        const shouldUpdateStatus = this.groupBy !== GroupingOptions.NONE;
        this.selectedId = '';
        this.removeDragScrollListeners();
        const dragData = { ...this.dragData } as any;
        this.isDragging = false;
        // we are moving to another status
        // we are not updating order
        if (!dropAnchor) {
            this.$entities.page.setPageListStatus(
                dragData.entityId,
                dragData.data.pageId,
                status,
            );
            // this.$entities.page.setViewOrder(
            //     dragData.entityId,
            //     dragData.data.pageId,
            //     null,
            //     status,
            // );
            this.dropAnimation(dragData.data.pageId);
            return;
        }
        const previousIndex = dropAnchor.index - 1;
        const previousItem = this.flatPageListData[previousIndex]?.data as any;
        // we are dragging to the first position
        // we are always updating order
        // we should update status, only if grouped
        if (!previousItem || !('order' in previousItem)) {
            this.$entities.page.setPageListOrder(
                dragData.entityId,
                dragData.data.pageId,
                dropAnchor.order - ViewPageOrderMultiplier,
            );
            if (shouldUpdateStatus) {
                this.$entities.page.setPageListStatus(
                    dragData.entityId,
                    dragData.data.pageId,
                    status,
                );
            }
            // this.$entities.page.setViewOrder(
            //     dragData.entityId,
            //     dragData.data.pageId,
            //     dropAnchor.order - ViewPageOrderMultiplier,
            //     status,
            // );

            this.dropAnimation(dragData.data.pageId);
            return;
        }
        const itemOrder = dropAnchor.order;
        const previousOrder = previousItem.order;
        const newOrder = this.$utils.pageList.calculateOrder(
            previousOrder,
            itemOrder,
        );
        // we are dropping in between 2 items
        // we are always updating order
        // we should update status, only if grouped
        this.$entities.page.setPageListOrder(
            dragData.entityId,
            dragData.data.pageId,
            newOrder,
        );
        if (shouldUpdateStatus) {
            this.$entities.page.setPageListStatus(
                dragData.entityId,
                dragData.data.pageId,
                status,
            );
        }
        // this.$entities.page.setViewOrder(
        //     dragData.entityId,
        //     dragData.data.pageId,
        //     newOrder,
        //     status,
        // );

        this.dropAnimation(dragData.data.pageId);
    }

    dropAnimation(pageId: string) {
        setTimeout(() => {
            const animation = animate(
                (this.$refs[`row-${pageId}`] as any).pageRef,
                {
                    background:
                        this.$store.getters['appSettings/theme'] ===
                        ThemeOptions.DARK
                            ? [
                                  null,
                                  '#262d39',
                                  'initial',
                                  '#262d39',
                                  'initial',
                                  null,
                              ]
                            : [
                                  null,
                                  '#eceef0',
                                  'initial',
                                  '#eceef0',
                                  'initial',
                                  null,
                              ],
                },
                {
                    duration: 1,
                },
            );
            animation.finished.then(() => {
                (this.$refs[`row-${pageId}`] as any).pageRef.style = undefined;
            });
        }, 100);
    }

    handleDragScroll() {
        if (!this.shouldDragScroll) return;
        this.$refs.virtualCollection.$el.scrollTop += this.scrollSpeed;
        this.dragThrottleByFps(() => {
            this.handleDragScroll();
        });
    }

    handleDragScrollStart(speed: number) {
        if (!this.shouldDragScroll) {
            this.shouldDragScroll = true;
            this.handleDragScroll();
        }
        this.scrollSpeed = speed;
    }

    handleDragScrollEnd() {
        this.shouldDragScroll = false;
        this.scrollSpeed = 0;
    }

    registerDragScrollListeners() {
        this.$nuxt.$on('view:drag:scrollStart', this.handleDragScrollStart);
        this.$nuxt.$on('view:drag:scrollEnd', this.handleDragScrollEnd);
    }

    removeDragScrollListeners() {
        this.shouldDragScroll = false;
        this.$nuxt.$off('view:drag:scrollStart', this.handleDragScrollStart);
        this.$nuxt.$off('view:drag:scrollEnd', this.handleDragScrollEnd);
    }

    removeShortcuts() {
        const availableShortcuts = this.$shortcutsManager.availableShortcuts;
        this.$shortcutsManager.removeShortcut(availableShortcuts.BLUR);
        this.$shortcutsManager.removeShortcut(availableShortcuts.VIEW_UP);
        this.$shortcutsManager.removeShortcut(availableShortcuts.VIEW_DOWN);
        this.$shortcutsManager.removeShortcut(availableShortcuts.VIEW_GROUP_UP);
        this.$shortcutsManager.removeShortcut(
            availableShortcuts.VIEW_GROUP_DOWN,
        );
        this.$shortcutsManager.removeShortcut(
            availableShortcuts.VIEW_COLLAPSE_SECTION,
        );
        this.$shortcutsManager.removeShortcut(
            availableShortcuts.VIEW_ARCHIVE_PAGE,
        );
        this.$shortcutsManager.removeShortcut(
            availableShortcuts.VIEW_DELETE_PAGE,
        );
        this.$shortcutsManager.removeShortcut(
            availableShortcuts.VIEW_PAGE_DETAIL,
        );
        this.$shortcutsManager.removeShortcut(availableShortcuts.VIEW_STATUS);
    }

    registerShortcuts() {
        this.$shortcutsManager.enableNamespace('editor-inactive');
        this.$shortcutsManager.enableNamespace('view');
        const availableShortcuts = this.$shortcutsManager.availableShortcuts;
        this.$shortcutsManager.registerShortcut(availableShortcuts.BLUR, () => {
            this.selectedId = '';
        });
        this.$shortcutsManager.registerShortcut(
            availableShortcuts.VIEW_UP,
            () => {
                this.handleArrows('ArrowUp');
            },
        );
        this.$shortcutsManager.registerShortcut(
            availableShortcuts.VIEW_DOWN,
            () => {
                this.handleArrows('ArrowDown');
            },
        );
        this.$shortcutsManager.registerShortcut(
            availableShortcuts.VIEW_GROUP_UP,
            () => {
                this.handleArrows('ArrowUp', true);
            },
        );
        this.$shortcutsManager.registerShortcut(
            availableShortcuts.VIEW_GROUP_DOWN,
            () => {
                this.handleArrows('ArrowDown', true);
            },
        );
        this.$shortcutsManager.registerShortcut(
            availableShortcuts.VIEW_COLLAPSE_SECTION,
            () => {
                const entity = this.flatPageListData[this.selectionIndex]?.data;
                if (
                    !entity ||
                    entity.id !== this.selectedId ||
                    entity.type !== PageListEntityType.SECTION_HEADER
                ) {
                    return;
                }

                this.handleCollapse(entity.id);
            },
        );
        this.$shortcutsManager.registerShortcut(
            [availableShortcuts.VIEW_PAGE_OPEN],
            () => {
                const selected =
                    this.flatPageListData[this.selectionIndex]?.data;

                if (!selected || selected.id !== this.selectedId) return;
                if (selected.type === PageListEntityType.PAGE) {
                    this.$tracking.trackEventV2(TrackingType.PAGE, {
                        action: TrackingAction.OPEN,
                        source: TrackingActionSource.SHORTCUT,
                        sourceMeta: this.source as string,
                        entityId: selected.id,
                    });
                    const tab = this.$tabs.createNewTabObject(
                        selected.id,
                        TabType.DOCUMENT,
                    );
                    this.$tabs.openTab(tab);
                }
                if (selected.type === PageListEntityType.PAGE_ADDER) {
                    // @ts-ignore
                    this.$refs[`adder-${selected.id}`].onStartInput();
                }
            },
        );
        this.$shortcutsManager.registerShortcut(
            [availableShortcuts.VIEW_ARCHIVE_PAGE],
            () => {
                const entity = this.flatPageListData[this.selectionIndex]?.data;
                if (
                    !entity ||
                    entity.id !== this.selectedId ||
                    entity.type !== PageListEntityType.PAGE
                ) {
                    return;
                }
                this.$utils.page.archivePage(entity);
            },
        );
        this.$shortcutsManager.registerShortcut(
            [availableShortcuts.VIEW_DELETE_PAGE],
            () => {
                const entity = this.flatPageListData[this.selectionIndex]?.data;
                if (
                    !entity ||
                    entity.id !== this.selectedId ||
                    entity.type !== PageListEntityType.PAGE
                ) {
                    return;
                }
                this.$utils.page.deletePage(entity);
            },
        );
        this.$shortcutsManager.registerShortcut(
            [availableShortcuts.VIEW_STATUS],
            () => {
                const entity = this.flatPageListData[this.selectionIndex]?.data;
                if (
                    !entity ||
                    entity.id !== this.selectedId ||
                    entity.type !== PageListEntityType.PAGE
                )
                    return;
                this.$refs[
                    `row-${entity.id}`
                    // @ts-ignore
                ]?.$refs?.pageStatus?.$refs?.statusSelect?.openDropdown();
            },
        );
        this.$shortcutsManager.registerShortcut(
            [availableShortcuts.TASKS_COMPLETE],
            () => {
                const entity = this.flatPageListData[this.selectionIndex]?.data;
                if (
                    !entity ||
                    entity.id !== this.selectedId ||
                    entity.type !== PageListEntityType.TASK
                )
                    return;
                const task = this.$entities.task.byId(entity.id);
                this.$entities.task.onCompletedToggle(task, true);
                if (!task.completed) {
                    this.$tracking.trackEventV2(TrackingType.TASK, {
                        action: TrackingAction.COMPLETE,
                        source: this.source,
                        entityId: task.id,
                    });
                }
            },
        );
        this.$shortcutsManager.registerShortcut(
            [availableShortcuts.TASKS_ACTIONS_NAVIGATE],
            () => {
                const entity = this.flatPageListData[this.selectionIndex]?.data;
                if (
                    !entity ||
                    entity.id !== this.selectedId ||
                    entity.type !== PageListEntityType.TASK
                )
                    return;
                const task = this.$entities.task.byId(entity.id);
                this.$entities.task.showInContext(
                    task,
                    this.source || undefined,
                );
            },
        );
    }

    beforeDestroy() {
        if (this.pageListResizeObserver) {
            this.pageListResizeObserver.disconnect();
        }
        this.removeDragScrollListeners();
        this.removeShortcuts();
    }

    beforeMount() {
        if (!this.entity) {
            this.$tabs.closeTabsByEntityId(this.entityId);
        }
    }

    mounted() {
        if (this.isActive) {
            this.registerShortcuts();
        }
        this.resizeListener();
        this.pageListResizeObserver = new ResizeObserver(this.resizeListener);
        if (this.$refs.pageListContent) {
            this.pageListResizeObserver.observe(this.$refs.pageListContent);
        }
        this.setInitialScrollPosition();
    }
}
</script>

<style scoped lang="scss">
.order-pill {
    @include frostedGlassBackground;
    @include font12-500;
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: 10px;
    z-index: 400;
    padding: 4px 8px;
    user-select: none;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
}

.drop-area {
    z-index: 399;
    position: absolute;
    width: 100%;
    border-radius: 6px;

    &:hover,
    &.active {
        border: var(--accent-color) 1px solid;
        background: rgba(var(--accent-color-triplet), 0.1);
    }
}

.drag-divider {
    z-index: 399;
    padding: 16px;
    position: absolute;
    width: 100%;

    &.top {
        top: -16px;
    }
    .bottom {
        bottom: 16px;
    }

    &:hover,
    &.active {
        .drag-divider__line {
            background: var(--accent-color);
        }
    }
    &__line {
        height: 2px;
    }
}
.page-list {
    height: 100%;
    width: 100%;

    &__filters {
        position: relative;
        top: -10px; // hack
        padding: 10px 0px;
        border-top: 1px solid var(--tab-divider-color);
        border-bottom: 1px solid var(--tab-divider-color);
        display: flex;
        justify-content: space-between;
        gap: 8px;

        &__definition {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        &__actions {
            //button {
            //    @include font12-500;
            //    outline: none;
            //}
        }
    }

    :deep(.vue-virtual-collection-container) {
        position: relative;
    }

    :deep(.cell-container) {
        position: absolute;
        top: 0;
        left: 0;

        &:has(> .cell) {
            z-index: 1;
        }
    }

    &__header-controls {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    &__wrapper {
        @include scrollbar;
        overflow-x: hidden;
        position: relative;
        padding: 0 20px;

        :deep(.vue-virtual-collection-container) {
            margin: 0 auto;
        }
    }
}
</style>
