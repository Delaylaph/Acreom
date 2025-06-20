<template>
    <div>
        <tippy
            :content="$utils.tooltip.getRefText"
            :delay="[200, 20]"
            :offset="`0, 0`"
            :touch="false"
            boundary="window"
            placement="top"
            theme="tooltip"
            target=".has-tippy"
        />
        <div
            :ref="`page-row-${document.id}`"
            class="document-row"
            :title="$entities.page.displayTitle(document)"
            :class="{ active: highlight || focused, dragging }"
            @contextmenu.prevent.stop="handleContextMenu"
            @click="onDocumentItemClick"
            @mousedown.prevent="handleDragStart"
            @mouseup.middle.stop.prevent="onDocumentItemClick"
            @mouseup="handleMouseUp"
        >
            <div class="document-row__title">
                <PageStatusComponent
                    v-if="shouldShowProperty('status')"
                    ref="pageStatus"
                    :tiny="true"
                    :entity-id="pageId"
                    :source="source"
                    :source-meta="TrackingActionSourceMeta.ROW_STATUS_PICKER"
                />
                <DocumentIcon
                    v-if="shouldShowProperty('icon')"
                    :document="document"
                    :size="14"
                    :icon-size="14"
                    font-size="14"
                    class="doc-icon"
                />
                <span class="title">{{ pageTitle }}</span
                ><span
                    v-if="
                        breadcrumbs &&
                        !pageHasProject &&
                        shouldShowProperty('breadcrumbs')
                    "
                    class="breadcrumbs"
                    >{{ breadcrumbs }}</span
                >
                <PageRowProject
                    v-if="pageHasProject && shouldShowProperty('project')"
                    :page-id="document.id"
                />
                <div
                    v-if="showClipPill && shouldShowProperty('clip')"
                    class="document-row__clips"
                >
                    <component
                        :is="$utils.integrations.getClipComponent(document)"
                        :clip="document.clip"
                    />
                </div>
                <PageRowDate
                    v-if="hasDate && shouldShowProperty('date')"
                    :page-id="document.id"
                />
                <EntityLinksPill
                    v-if="
                        $entities.page.hasLinks(document.id) &&
                        shouldShowProperty('links')
                    "
                    :links="$entities.page.getLinks(document.id)"
                    :backlinks="$entities.page.getBacklinks(document.id)"
                    :jira-links="$entities.page.getJiraLinks(document.id)"
                    :github-links="$entities.page.getGithubLinks(document.id)"
                    :linear-links="$entities.page.getLinearLinks(document.id)"
                    :source-meta="TrackingActionSourceMeta.LIST"
                />
                <PageRowTasks
                    v-if="tasksOnPage.length > 0 && shouldShowProperty('tasks')"
                    ref="pageTasks"
                    :page-id="document.id"
                    :source="source"
                />
            </div>
            <div class="document-row__date-properties">
                <div class="view-page-labels">
                    <template  v-for="label in pageLabels">
                        <span class="label">{{ label }}</span>
                    </template>
                </div>
                <span
                    v-if="shouldShowProperty('updated')"
                    class="has-tippy"
                    :data-tippy-content="longUpdatedAt"
                >
                    {{ formatUpdatedAt }}
                </span>
                <span
                    v-if="shouldShowProperty('created')"
                    class="has-tippy"
                    :data-tippy-content="longCreatedAt"
                >
                    {{ formatCreatedAt }}
                </span>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Inject, Prop, Vue } from 'vue-property-decorator';
import { format, parse } from 'date-fns';
import DocumentIcon from '~/components/document/DocumentIcon.vue';
import { DocumentContextMenu } from '~/components/context-menu';
import { currentTimezone, localizedRelativeFormat } from '~/helpers/date';
import { FolderType, PageListType, TabType } from '~/constants';
import InterfaceContentArchive from '~/components/streamline/InterfaceContentArchive.vue';
import { PageListSymbols, TabSymbols } from '~/constants/symbols';
import JiraIcon from '~/components/icons/JiraIcon.vue';
import PageStatusComponent from '~/components/entities/page/PageStatusComponent.vue';
import GithubClipPill from '~/components/github/GithubClipPill.vue';
import JiraClipPill from '~/components/jira/JiraClipPill.vue';
import { isGithubEntity } from '~/plugins/entities/github';
import EntityLinksPill from '~/components/entities/EntityLinksPill.vue';
import PageRowTasks from '~/components/page-list/list/page-row/PageRowTasks.vue';
import PageRowDate from '~/components/page-list/list/page-row/PageRowDate.vue';
import { isJiraEntity } from '~/plugins/entities/jira';
import URLClipPill from '~/components/integrations/clip/URLClipPill.vue';
import {
    TrackingAction,
    TrackingActionSource,
    TrackingActionSourceMeta,
    TrackingType,
} from '~/@types/tracking';
import PageRowProject from '~/components/page-list/list/page-row/PageRowProject.vue';

@Component({
    name: 'PageRow',
    computed: {
        TrackingActionSourceMeta() {
            return TrackingActionSourceMeta;
        },
    },
    methods: { isJiraEntity, isGithubEntity },
    components: {
        PageRowProject,
        URLClipPill,
        PageRowDate,
        PageRowTasks,
        PageStatusComponent,
        EntityLinksPill,
        JiraClipPill,
        GithubClipPill,
        InterfaceContentArchive,
        DocumentIcon,
        JiraIcon,
    },
    filters: {
        capitalize(value: string) {
            if (!value) return '';
            return value.charAt(0).toUpperCase() + value.slice(1);
        },
    },
})
export default class PageRow extends Vue {
    @Prop()
    document!: any;

    @Prop({
        default: null,
    })
    level!: number | null;

    @Prop({ default: false })
    focused!: boolean;

    @Prop({ default: false })
    dragging!: boolean;

    @Inject(TabSymbols.TAB_ID)
    tabId!: string;

    @Inject(TabSymbols.ENTITY_ID)
    entityId!: string;

    @Inject(TabSymbols.TAB_GROUP_ID)
    groupId!: string;

    @Inject(PageListSymbols.TYPE)
    pageListType!: PageListType;

    $refs!: {
        pageTasks: any;
        pageStatus: any;
    };

    highlight: boolean = false;
    dragTimeout: any;

    get isDragging() {
        return this.$utils.pageList.getDragData();
    }

    get pageRef() {
        return (this.$refs as any)[`page-row-${this.document.id}`];
    }

    get pageHasProject() {
        return (
            !!this.document.projectId &&
            !!this.$entities.project.byId(this.document.projectId)
        );
    }

    get hasDate() {
        return this.document.start;
    }

    get group() {
        return this.$store.getters['tabs/groupById'](this.groupId);
    }

    get viewOptions() {
        return this.$utils.pageList.getPageListViewOptions(
            this.pageListType,
            this.entityId,
        );
    }

    get selectedDisplayProperties() {
        return this.viewOptions.selectedDisplayProperties;
    }

    get propertiesMap() {
        return this.$entities.page.getPostprocessingMap(this.document?.id);
    }

    get tasksOnPage() {
        return this.propertiesMap?.tasks ?? [];
    }

    get entity() {
        return this.$store.getters['integrationData/byId'](this.document?.clip);
    }

    get showClipPill() {
        return (
            this.$entities.page.hasClip(this.document) &&
            !!this.$utils.integrations.getClipComponent(this.document)
        );
    }

    get pageTitle() {
        return this.document?.title && this.document.title !== ''
            ? this.document.title
            : 'Untitled';
    }

    get pageLabels() {
        return this.document?.labels;
    }

    get pageId() {
        return this.document?.id ?? null;
    }

    get breadcrumbs() {
        return this.$store.getters['document/breadcrumbsById'](
            this.document.id,
        );
    }

    get source() {
        return this.$tracking.resolveSourceFromTab(this.tabId);
    }

    get formatUpdatedAt(): string {
        return format(
            new Date(this.document.updatedAt || new Date()),
            `d MMM`,
            {
                timeZone: currentTimezone(),
            },
        );
    }

    get formatCreatedAt(): string {
        return format(
            new Date(this.document.createdAt || new Date()),
            `d MMM`,
            {
                timeZone: currentTimezone(),
            },
        );
    }

    get longCreatedAt() {
        return `<span class='tooltip'>Created ${localizedRelativeFormat(
            new Date(this.document.createdAt || new Date()),
            new Date(),
            this.$store.getters['appSettings/dateTimeOptions'].timeFormat,
        )}</span>`;
    }

    get longUpdatedAt() {
        return `<span class='tooltip'>Updated ${localizedRelativeFormat(
            new Date(this.document.updatedAt || new Date()),
            new Date(),
            this.$store.getters['appSettings/dateTimeOptions'].timeFormat,
        )}</span>`;
    }

    onDocumentItemClick(event: MouseEvent) {
        if (this.isDragging) return;

        if (this.document.dailyDoc) {
            this.$tracking.trackEventV2(TrackingType.MY_DAY, {
                source: TrackingActionSource.ALL_PAGES,
                action: TrackingAction.OPEN,
            });
            return this.$entities.myDay.open({
                event,
                data: {
                    date: parse(
                        this.document.dailyDoc,
                        'yyyy-MM-dd',
                        new Date(),
                    ),
                },
            });
        }

        this.$tracking.trackEventV2(TrackingType.PAGE, {
            action: TrackingAction.OPEN,
            source: this.source,
            sourceMeta: this.$tracking.resolveSourceMetaFromTab(this.tabId),
        });

        const tab = this.$tabs.createNewTabObject(
            this.document.id,
            TabType.DOCUMENT,
        );

        this.$tabs.openTabWithEvent(tab, event);
    }

    shouldShowProperty(propertyName: string) {
        const allowedProperties =
            this.$utils.pageList.getAllowedDisplayProperties(
                this.pageListType,
                this.entityId,
            );
        const selectedProperties = this.selectedDisplayProperties ?? [];
        return (
            allowedProperties.includes(propertyName) &&
            selectedProperties.includes(propertyName)
        );
    }

    async handleContextMenu(e: MouseEvent) {
        this.highlight = true;
        const tab = this.$tabs.createNewTabObject(
            this.document.id,
            TabType.DOCUMENT,
        );
        await this.$contextMenu.show(e, {
            component: DocumentContextMenu,
            bind: {
                id: this.document.id,
                tab,
                source: this.source,
            },
        });

        this.highlight = false;
    }

    handleMouseUp() {
        if (this.dragTimeout) {
            clearTimeout(this.dragTimeout);
            this.dragTimeout = null;
        }
    }

    handleDragStart(e: MouseEvent) {
        if (e.button !== 0) return;
        this.dragTimeout = setTimeout(() => {
            clearTimeout(this.dragTimeout);
            this.dragTimeout = null;
            this.$emit('page:dragstart', {
                offsetX: e.offsetX,
                offsetY: e.offsetY,
                pageX: e.pageX,
                pageY: e.pageY,
                pageId: this.document.id,
                tabId: this.tabId,
                width: (this.$refs as any)[`page-row-${this.document.id}`]
                    .offsetWidth,
            });
        }, 200);
    }
}
</script>
<style lang="scss" scoped>
.document-row {
    overflow: hidden;
    position: relative;
    user-select: none;
    cursor: default;
    display: grid;
    grid-template-columns: minmax(215px, max-content) min-content;
    justify-content: space-between;
    align-items: center;
    padding: 4px 10px 4px 12px;
    border-radius: 6px;
    gap: 10px;

    &__clips {
        flex-shrink: 0;
    }

    .document-drag-node {
        bottom: -200px;
        position: absolute;

        .untitled {
            color: var(--document-card-untitled-text-color);
        }
    }

    &.dragging {
        pointer-events: none;
        opacity: 0.3;
    }

    &:hover,
    &.active {
        .doc-icon {
            color: var(--sidebar-icon-color__hover);
        }

        background: var(--document-card-bg-color_hover);

        .document-row__title {
            color: var(--document-card-title-text-color__hover);

            &.archived {
                color: var(--document-card-title-text-color__archived__hover);
            }
        }
    }

    &__title {
        display: flex;
        align-items: center;
        overflow: hidden;
        gap: 8px;

        .clip-key {
            color: var(--document-card-title-icon-color);
            margin-right: 4px;
            margin-left: 2px;
            font-size: 14px;
        }

        .doc-icon {
            flex-shrink: 0;
            color: var(--sidebar-icon-color);
        }

        .title {
            @include ellipsis;
        }

        .breadcrumbs {
            color: var(--document-row-breadcrumbs-color);
            flex-shrink: 0;
        }

        font-weight: 500;
        font-size: 13px;
        line-height: 24px;
        color: var(--jira-issue-text-color); // TODO: theme not same as card
    }

    &__content {
        @include ellipsis;
        @media (max-width: 595px) {
            display: none;
        }

        font-weight: normal;
        font-size: 13px;
        line-height: 23px;
        color: var(--document-card-meta-text-color);
    }

    &__date-properties {
        display: grid;
        grid-template-columns: repeat(3, min-content);
        align-items: center;
        gap: 4px;

        span {
            @include ellipsis;
            @media (max-width: 595px) {
                display: none;
            }
            text-align: right;
            font-weight: normal;
            font-size: 13px;
            line-height: 17px;
            color: var(--document-card-meta-text-color);
            white-space: nowrap;
        }
    }
}
.view-page-labels {
    display: flex;
    gap: 2px;
    margin-right: 8px;

    span {
        color: var(--accent-color);
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 12px;
        line-height: 16px;
        font-weight: 500;
    }
}
</style>
