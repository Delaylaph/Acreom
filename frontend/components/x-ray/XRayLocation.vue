<template>
    <div class="x-ray-location">
        <button
            v-if="project"
            class="x-ray-location__project"
            @click="focusProject(project.id)"
        >
            <div
                v-if="project.icon"
                class="x-ray-location__project__custom-icon icon"
            >
                <span>{{ project.icon }}</span>
            </div>
            <InterfaceFolder v-else class="icon" size="14" />
            <span class="x-ray-location__project__name">{{
                project.name || 'New Folder'
            }}</span>
        </button>
        <button
            v-else-if="page.archived"
            class="x-ray-location__project"
            @click="openArchive"
        >
            <InterfaceContentArchive class="icon" size="14" />
            <span class="x-ray-location__project__name">Archive</span>
        </button>
        <button v-else class="x-ray-location__project" @click="openAllPages">
            <InterfaceFileDouble class="icon" size="14" />
            <span class="x-ray-location__project__name">All Pages</span>
        </button>
        <div v-if="!isMobile" class="x-ray-location__labels">
            <button
                v-for="label in labels"
                :key="label"
                class="x-ray-location__labels__label"
                @click="openAllPagesFilter(label)"
            >
                <p>{{ label }}</p>
            </button>
        </div>
        <div v-else class="x-ray-location__labels">
            <div
                v-for="label in labels"
                :key="label"
                class="x-ray-location__labels__label"
            >
                <p>{{ label }}</p>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import DocumentLink from '~/components/document/DocumentLink.vue';
import { IFolder } from '~/@types';
import InterfaceFolder from '~/components/streamline/InterfaceFolder.vue';
import InterfaceContentFileAlternate from '~/components/streamline/InterfaceContentFileAlternate.vue';
import InterfaceFavoriteStar from '~/components/streamline/InterfaceFavoriteStar.vue';
import { TabType, ViewType } from '~/constants';
import InterfaceFileDouble from '~/components/streamline/InterfaceFileDouble.vue';
import { TrackEvent } from '~/helpers/decorators';
import {
    TrackingAction,
    TrackingActionSource,
    TrackingType,
} from '~/@types/tracking';
import InterfaceContentArchive from '~/components/streamline/InterfaceContentArchive.vue';

@Component({
    name: 'XRayLocation',
    components: {
        InterfaceContentArchive,
        InterfaceFileDouble,
        DocumentLink,
        InterfaceFolder,
        InterfaceContentFileAlternate,
        InterfaceFavoriteStar,
    },
})
export default class XRayLocation extends Vue {
    @Prop({
        default: null,
    })
    page!: any;

    @Prop({
        default: () => [],
    })
    labels!: string[];

    @Prop({ default: false })
    isMobile!: boolean;

    get currentOperation() {
        return this.$utils.pageList.getFilterOperation();
    }
    
    get project() {
        if (!this.page) return null;
        if (!this.page.projectId) return null;

        return this.$entities.folder.byId(this.page.projectId);
    }

    @TrackEvent(TrackingType.INFO_PANEL, {
        action: TrackingAction.CLICK_LOCATION,
    })
    async focusProject(id: string) {
        if (this.$utils.isMobile) {
            this.$emit('link:navigate');
            return;
        }
        const crumbs = this.$entities.folder
            .getParents(id)
            .map(({ id }: IFolder) => {
                return this.$entities.folder.toggleExpanded(id, true);
            });

        await Promise.all(crumbs);

        this.$nextTick(() => {
            this.$nuxt.$emit(`focus:folder-${id}`);
        });
    }

    @TrackEvent(TrackingType.ALL_PAGES, {
        action: TrackingAction.OPEN,
        source: TrackingActionSource.INFO_PANEL,
    })
    openAllPages() {
        if (this.$utils.isMobile) {
            this.$emit('link:navigate');
            return;
        }
        const allPagesView = this.$entities.view.getViewByType(
            ViewType.ALL_PAGES,
        );
        const tab = this.$tabs.createNewTabObject(
            allPagesView.id,
            TabType.VIEW,
        );
        this.$tabs.openTab(tab);
    }

    @TrackEvent(TrackingType.ARCHIVE, {
        action: TrackingAction.OPEN,
        source: TrackingActionSource.INFO_PANEL,
    })
    openArchive() {
        if (this.$utils.isMobile) {
            this.$emit('link:navigate');
            return;
        }
        const archiveView = this.$entities.view.getViewByType(ViewType.ARCHIVE);
        const tab = this.$tabs.createNewTabObject(archiveView.id, TabType.VIEW);
        this.$tabs.openTab(tab);
    }

    @TrackEvent(TrackingType.INFO_PANEL, {
        action: TrackingAction.CLICK_LABEL,
    })
    openAllPagesFilter(_tag: string) {
        if (this.$utils.isMobile) {
            this.$emit('link:navigate');
            return;
        }
        const allPagesView = this.$entities.view.getViewByType(
            ViewType.ALL_PAGES,
        );
        const tab = this.$tabs.createNewTabObject(
            allPagesView.id,
            TabType.VIEW,
            {
                filterDefinition: [
                    {
                        property: 'labels',
                        operation: this.currentOperation,
                        value: [_tag],
                    },
                ],
            },
        );
        this.$tabs.openTab(tab);
    }
}
</script>

<style lang="scss" scoped>
.x-ray-location {
    &__project {
        @include font12-500;
        display: flex;
        align-items: center;
        max-width: 100%;
        margin-bottom: 10px;
        padding: 4px 8px 4px 8px;
        border-radius: 6px;
        color: var(--x-ray-location-button-text-color);
        overflow: hidden;

        &:hover {
            color: var(--x-ray-location-button-text-color__hover);
            background: var(--x-ray-location-button-bg-color__hover);
        }

        &__custom-icon {
            width: 16px;
            height: 16px;
            font-size: 14px;
            border-radius: 4px;
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 12px;

            span {
                overflow: visible;
                font-size: 14px;
                line-height: 20px;
                font-family: 'Apple Color Emoji', 'Segoe UI Emoji',
                    NotoColorEmoji, 'Noto Color Emoji', 'Segoe UI Symbol',
                    'Android Emoji', EmojiSymbols, serif;
            }
        }

        .icon {
            margin-right: 8px;
        }

        &__name {
            @include ellipsis;
        }
    }

    &__labels {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        &__label {
            @include font12-500;

            padding: 4px 8px 4px 8px;
            border-radius: 6px;

            overflow: hidden;
            max-width: 100%;
            text-align: left;

            p {
                @include ellipsis;
            }

            margin-bottom: 0;
            line-height: 20px;
            color: var(--accent-color);

            &:hover {
                background: var(--x-ray-location-button-bg-color__hover);
            }
        }
    }
}
</style>
