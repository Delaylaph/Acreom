<template>
    <div v-if="page && !page.template">
        <div v-if="showControls" class="entity-controls" :style="{ maxWidth: isWideEditor ? '100%' : contentWidth + 'px' }">
            <PageStatusComponent
                v-if="showStatus"
                :source="source"
                :source-meta="TrackingActionSourceMeta.PAGE"
                :entity-id="entityId"
            />
            <PageProjectComponent v-if="showProject" :entity-id="entityId" />
            <component
                :is="controlsComponent"
                v-if="showClip"
                @focus-tab="$emit('focus-tab')"
            />
            <DatePicker v-if="showDatePicker" :task-data="page" />
            <button
                v-if="showBacklinks"
                ref="linksButton"
                class="backlinks"
                :class="{ active: linksOpen }"
                tabindex="-1"
                @click="openLinks"
            >
                <InterfaceArrowsDiagonalAlternate class="icon" />
                <span
                    >{{ linksLength }} Link{{
                        linksLength > 1 ? 's' : null
                    }}</span
                >
            </button>
        </div>
    </div>
</template>
<script lang="ts">
import { Component, Inject, InjectReactive, Vue, Prop } from 'vue-property-decorator';
import { TabSymbols } from '~/constants/symbols';
import DatePicker from '~/components/date-picker/DatePicker.vue';
import InterfaceArrowsCornerUpRight from '~/components/streamline/InterfaceArrowsCornerUpRight.vue';
import LinksDropdown from '~/components/dropdown/LinksDropdown.vue';
import InterfaceArrowsDiagonal1Alternate from '~/components/streamline/InterfaceArrowsDiagonal1Alternate.vue';
import InterfaceArrowsDiagonal from '~/components/streamline/InterfaceArrowsDiagonal.vue';
import InterfaceArrowsDiagonalAlternate from '~/components/streamline/InterfaceArrowsDiagonalAlternate.vue';
import PageStatusComponent from '~/components/entities/page/PageStatusComponent.vue';
import { TrackingActionSourceMeta } from '~/@types/tracking';
import PageProjectComponent from '~/components/entities/page/PageProjectComponent.vue';

@Component({
    name: 'EntityControls',
    computed: {
        TrackingActionSourceMeta() {
            return TrackingActionSourceMeta;
        },
    },
    components: {
        PageProjectComponent,
        PageStatusComponent,
        InterfaceArrowsDiagonalAlternate,
        InterfaceArrowsDiagonal,
        InterfaceArrowsDiagonal1Alternate,
        InterfaceArrowsCornerUpRight,
        DatePicker,
    },
})
export default class EntityControls extends Vue {
    @Inject(TabSymbols.ENTITY_ID)
    entityId!: string;

    @Inject(TabSymbols.TAB_ID)
    tabId!: string;

    @InjectReactive(TabSymbols.ENTITY_TYPE)
    entityType!: string;

    @Prop({ type: Boolean, default: false })
    isWideEditor!: boolean;

    $refs!: {
        linksButton: HTMLButtonElement;
    };

    linksOpen: boolean = false;

    get source() {
        return this.$tracking.resolveSourceFromTab(this.tabId);
    }
    get contentWidth() {
        return this.$store.getters['appSettings/editorOptions'].contentWidth;
    }

    get page() {
        return (
            this.$store.getters['document/byId'](this.entityId) ??
            this.$store.getters['document/byClip'](this.entityId) ??
            null
        );
    }

    get controlsComponent() {
        return this.$componentsRepository.getControls(
            this.entityType,
            this.tabId,
        );
    }

    get showDatePicker() {
        return !!this.page.start;
    }

    get showControls() {
        return (
            this.showStatus ||
            this.showProject ||
            this.showClip ||
            this.showDatePicker ||
            this.showBacklinks
        );
    }

    get showBacklinks() {
        return this.linksLength > 0;
    }

    get showStatus() {
        return !!this.page.pageStatus;
    }

    get showProject() {
        return (
            !!this.page.projectId &&
            !!this.$entities.project.byId(this.page.projectId)
        );
    }

    get showClip() {
        return !!this.controlsComponent;
    }

    get links() {
        return this.$entities.page.getLinks(this.page?.id);
    }

    get githubLinks() {
        return this.$entities.page.getGithubLinks(this.page?.id);
    }

    get jiraLinks() {
        return this.$entities.page.getJiraLinks(this.page?.id);
    }

    get linearLinks() {
        return this.$entities.page.getLinearLinks(this.page?.id);
    }

    get backlinks() {
        return this.$entities.page.getBacklinks(this.page?.id);
    }

    get linksLength() {
        return (
            this.links.length +
            this.backlinks.length +
            this.githubLinks.length +
            this.jiraLinks.length +
            this.linearLinks.length
        );
    }

    openLinks() {
        this.linksOpen = true;
        const parent = this.$refs.linksButton;
        if (!parent) return;

        this.$dropdown.show({
            component: LinksDropdown,
            parent,
            bind: {
                links: this.links,
                backlinks: this.backlinks,
                githubLinks: this.githubLinks,
                jiraLinks: this.jiraLinks,
                linearLinks: this.linearLinks,
                sourceMeta: TrackingActionSourceMeta.DETAIL,
            },
            onClose: () => {
                this.linksOpen = false;
            },
        });
    }
}
</script>
<style lang="scss" scoped>
.entity-controls {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 8px;
    margin: 5px auto 10px;
    padding: 9px 0px;
    border-top: 1px solid var(--tab-divider-color);
    border-bottom: 1px solid var(--tab-divider-color);


    .backlinks {
        @include font12-500;
        border-radius: 6px;
        color: var(--jira-clip-key-text-color);
        background: var(--entities-controls-backlinks-bg-color);
        display: grid;
        grid-template-columns: 16px auto;
        align-items: center;
        padding: 5px 8px;
        gap: 6px;
        user-select: none;

        span {
            white-space: nowrap;
        }

        .icon {
            color: var(--a-select-icon-default-color);
        }

        &:hover,
        &.active {
            background: var(--a-select-button-highlight-bg);
            color: var(--entities-controls-backlinks-text-color__hover);

            //.icon {
            //    color: var(--entities-controls-backlinks-icon-color__hover);
            //}
        }
    }
}
</style>
