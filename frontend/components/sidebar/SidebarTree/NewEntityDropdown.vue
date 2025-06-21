<template>
    <div class="new-entity-dropdown">
        <button class="new-entity-dropdown__entity-wrapper" @click="newFolder">
            <div class="new-entity-dropdown__entity">
                <InterfaceFolder class="icon" />
                New Folder
            </div>
            <div class="new-entity-dropdown__entity__text">Create Folder</div>
        </button>
        <button class="new-entity-dropdown__entity-wrapper" @click="newProject">
            <div class="new-entity-dropdown__entity">
                <InterfaceDashboardLayoutSquare class="icon" /> New Project
            </div>
            <div class="new-entity-dropdown__entity__text">Create Folder</div>
        </button>
        <button class="new-entity-dropdown__entity-wrapper" @click="newView">
            <div class="new-entity-dropdown__entity">
                <InterfaceAlignLayers1 class="icon" />
                New View
            </div>
            <div class="new-entity-dropdown__entity__text">
                Create a View of Pages with specific properties
            </div>
        </button>
    </div>
</template>
<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { v4 } from 'uuid';
import { IDocument } from '~/components/document/model';
import InterfaceFolder from '~/components/streamline/InterfaceFolder.vue';
import InterfaceDashboardLayoutSquare from '~/components/streamline/InterfaceDashboardLayoutSquare.vue';
import { FolderType, TabType } from '~/constants';
import {
    TrackingAction,
    TrackingActionSource,
    TrackingType,
} from '~/@types/tracking';
import InterfaceAlignLayers1 from '~/components/streamline/InterfaceAlignLayers1.vue';

@Component({
    name: 'NewEntityDropdown',
    components: {
        InterfaceAlignLayers1,
        InterfaceDashboardLayoutSquare,
        InterfaceFolder,
    },
})
export default class NewEntityDropdown extends Vue {
    async newFolder() {
        this.$emit('close');
        const activeFolder = this.$entities.folder.getActiveFolder();
        const shouldUseParentProperties = activeFolder?.type === FolderType.FOLDER;
        const id = await this.$entities.folder.newFolder({
            sharingUuid: shouldUseParentProperties && activeFolder?.sharingUuid ? v4() : null,
            parentId: shouldUseParentProperties ? activeFolder!.id : null,
        });
        this.$tracking.trackEventV2(TrackingType.FOLDER, {
            action: TrackingAction.CREATE,
            source: TrackingActionSource.SIDEBAR_FOOTER,
            entityId: id,
        });
    }

    async newProject() {
        this.$emit('close');
        const id = await this.$entities.project.newProject();
        const tab = this.$tabs.createNewTabObject(id, TabType.PROJECT, {
            editingProject: true,
        });
        await this.$tabs.openTab(tab);
        this.$tracking.trackEventV2(TrackingType.PROJECT, {
            action: TrackingAction.CREATE,
            source: TrackingActionSource.SIDEBAR_FOOTER,
            entityId: id,
        });
    }

    async newView() {
        this.$emit('close');
        const id = await this.$entities.view.newView();
        const tab = this.$tabs.createNewTabObject(id, TabType.VIEW);
        await this.$tabs.openTab(tab);
        this.$tracking.trackEventV2(TrackingType.CUSTOM_VIEW, {
            action: TrackingAction.CREATE,
            source: TrackingActionSource.SIDEBAR_FOOTER,
            entityId: id,
        });
    }
}
</script>
<style lang="scss" scoped>
.new-entity-dropdown {
    @include frostedGlassBackground;
    padding: 6px;
    border-radius: 10px;
    user-select: none;
    width: 223px;

    &__entity-wrapper {
        width: 100%;
        padding: 5px 0 6px 9px;
        border-radius: 6px;

        &:hover {
            .icon {
                color: var(--dropdown-controls-display-properties-text-color);
            }

            background: var(--dropdown-controls-select-bg-color__hover);
        }
    }

    &__entity {
        @include font12-500;
        display: grid;
        grid-template-columns: min-content 1fr;
        gap: 12px;
        align-items: center;
        text-align: left;
        color: var(--context-menu-button-text-color);

        .icon {
            color: var(--dropdown-button-text-color);
        }

        &__text {
            @include font11-500;
            text-align: left;
            color: var(--sidebar-new-entity-dropdown-text-color);
            margin-left: 26px;
        }
    }
}
</style>
