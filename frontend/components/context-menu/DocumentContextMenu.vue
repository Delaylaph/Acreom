<template>
    <div class="document-context-menu" :class="{ moving }">
        <DropdownButton
            v-if="showInfoPanelToggle"
            class="my-day-context-menu--option"
            @click="toggleInfoPanel"
        >
            <InterfaceAlertInformationCircle class="icon" />
            Toggle Info Panel
        </DropdownButton>
        <div v-if="isBasicContextMenu">
            <DropdownButton
                v-if="
                    !document.dailyDoc &&
                    !document.template &&
                    invokeFrom !== 'header'
                "
                tabindex="-1"
                @click="renameMode = true"
            >
                <InterfaceEditPencil size="14" class="icon" />
                Rename
            </DropdownButton>
            <DropdownButton
                v-if="!document.dailyDoc && !document.template"
                @click="pickDate"
            >
                <InterfaceCalendar class="icon" size="14" />
                Schedule
            </DropdownButton>
            <PageStatusControls
                v-if="!document.dailyDoc && !document.template"
                :page="document"
                :source="source"
                :source-meta="TrackingActionSourceMeta.CONTEXT_MENU"
                @close="$emit('close')"
            />
            <AddExistingClipIntegrationSelector
                v-if="!hasClip && !document.dailyDoc && !document.template"
                :page="document"
                :source="source"
                @close="$emit('close')"
            />
            <DropdownButton
                v-else-if="!document.dailyDoc && !document.template"
                tabindex="-1"
                @click="removeClip"
            >
                <InterfaceUnlink class="icon" size="14" />
                Remove Clip
            </DropdownButton>
            <DropdownButton
                v-if="
                    !document.dailyDoc && !document.template && !document.pinned
                "
                tabindex="-1"
                @click="pin"
            >
                <InterfaceEditPin2 size="14" class="icon" />
                Pin
            </DropdownButton>
            <DropdownButton
                v-else-if="!document.dailyDoc && !document.template"
                tabindex="-1"
                @click="unpin"
            >
                <InterfaceEditPin2 size="14" class="icon" />
                Unpin
            </DropdownButton>
            <DropdownButton
                v-if="!document.dailyDoc && !document.template"
                tabindex="-1"
                @click="moveMode = true"
            >
                <InterfaceArrowsBendRight1Alternate class="icon" size="14" />
                {{ document.archived ? 'Restore and Move To' : 'Move To' }}
            </DropdownButton>
            <DropdownButton
                v-if="!document.dailyDoc && !document.template"
                tabindex="-1"
                @click.stop="duplicateDocument"
            >
                <InterfaceFileDoubleAlt class="icon" size="14" />
                Duplicate
            </DropdownButton>
            <DropdownButton
                v-if="!document.dailyDoc && notLocal && !document.template"
                tabindex="-1"
                @click="shareDocument"
            >
                <InterfaceShare class="icon" size="14" />
                Share
            </DropdownButton>
            <DropdownButton
                v-if="
                    !document.dailyDoc &&
                    !document.template &&
                    !document.archived
                "
                data-e2e="document-context-menu-archive"
                tabindex="-1"
                @click="archiveDocument"
            >
                <InterfaceContentArchive class="icon" size="14" />
                Archive
            </DropdownButton>
            <DropdownButton
                v-if="
                    !document.dailyDoc &&
                    !document.template &&
                    document.archived
                "
                data-e2e="document-context-menu-archive"
                tabindex="-1"
                @click="restoreDocument"
            >
                <InterfaceContentArchive class="icon" size="14" />
                Restore
            </DropdownButton>
            <DropdownButton
                v-if="!document.dailyDoc && !document.template"
                data-e2e="document-context-menu-archive"
                class="danger"
                tabindex="-1"
                @click="deleteForever"
            >
                <InterfaceDeleteBin1 class="icon" size="14" />
                Delete
            </DropdownButton>
            <hr v-if="!document.dailyDoc && !document.template" />
            <DropdownButton
                v-if="!document.dailyDoc && !document.template"
                tabindex="-1"
                @click.stop="templateFromPage"
            >
                <InterfaceFileAddAlt class="icon" size="14" />
                Save as template
            </DropdownButton>
            <DropdownButton
                v-if="!document.dailyDoc && !document.template"
                tabindex="-1"
                @click.stop="exportMarkdown"
            >
                <InterfaceDownloadSquare size="14" class="icon" />
                Export markdown
            </DropdownButton>
            <DropdownButton
                v-if="document.filepath && !document.template"
                @click="openInFinder"
            >
                <InterfaceLinkSquare class="icon" size="14" />
                Show in
                {{ $config.os === 'mac' ? 'finder' : 'file explorer' }}
            </DropdownButton>
            <DropdownButton
                v-if="document.template"
                tabindex="-1"
                @click.stop="createPageFromTemplate"
            >
                <InterfaceFileAddAlt class="icon" size="14" />
                New from template
            </DropdownButton>
            <DropdownButton
                v-if="!document.dailyDoc && !document.template"
                tabindex="-1"
                @click="showVersionsModal"
            >
                <InterfaceTimeRewind class="icon" size="14" />
                Version History
            </DropdownButton>
            <DropdownButton
                v-if="document.template"
                class="danger"
                tabindex="-1"
                @click="deleteTemplate"
            >
                <InterfaceDeleteBin1 class="icon" size="14" />
                Delete
            </DropdownButton>
        </div>
        <ProjectSelector
            v-else-if="moving"
            :document="document"
            :source="source"
            @close="handleProjectSelectorClose"
        />
        <ProjectEditor
            v-else-if="renaming"
            :project="document"
            :renaming="true"
            @close="handleProjectSelectorClose"
        />
        <PageDatePickerDropdown
            v-else-if="scheduling"
            :page-id="document.id"
            :context-menu-invoke="true"
            :source="source"
            @close="$emit('close')"
        />
        <div v-if="showSidebarTabControls">
            <slot name="tab-options" />
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import { saveAs } from 'file-saver';
import ProjectSelector from '@/components/header/ProjectSelector.vue';
import { SafeElectronWindow } from '~/@types';
import { isElectron } from '~/helpers/is-electron';
import { ServiceKey, UtilActions } from '~/constants';
import InterfaceDeleteBin1 from '~/components/streamline/InterfaceDeleteBin1.vue';
import InterfaceEditPencil from '~/components/streamline/InterfaceEditPencil.vue';
import InterfaceArrowsBendRight1Alternate from '~/components/streamline/InterfaceArrowsBendRight1Alternate.vue';
import InterfaceShare from '~/components/streamline/InterfaceShare.vue';
import InterfaceLinkSquare from '~/components/streamline/InterfaceLinkSquare.vue';
import InterfaceFileDoubleAlt from '~/components/streamline/InterfaceFileDoubleAlt.vue';
import InterfaceFileAddAlt from '~/components/streamline/InterfaceFileAddAlt.vue';
import InterfaceEditPin2 from '~/components/streamline/InterfaceEditPin2.vue';
import InterfaceDownloadSquare from '~/components/streamline/InterfaceDownloadSquare.vue';
import InterfaceContentArchive from '~/components/streamline/InterfaceContentArchive.vue';
import InterfaceAlertInformationCircle from '~/components/streamline/InterfaceAlertInformationCircle.vue';
import DropdownButton from '~/components/dropdown/DropdownButton.vue';
import InterfaceUnlink from '~/components/streamline/InterfaceUnlink.vue';
import InterfaceCalendar from '~/components/streamline/InterfaceCalendar.vue';
import InterfaceLink from '~/components/streamline/InterfaceLink.vue';
import ProjectEditor from '~/components/context-menu/ProjectEditor.vue';
import PageStatusControls from '~/components/context-menu/PageStatusControls.vue';
import PageDatePickerDropdown from '~/components/document/PageDatePickerDropdown.vue';
import AddExistingClipIntegrationSelector from '~/components/document/AddExistingClipIntegrationSelector.vue';
import InterfaceBookmark from '~/components/streamline/InterfaceBookmark.vue';
import InterfaceTimeRewind from '~/components/streamline/InterfaceTimeRewind.vue';
import {
    TrackingAction,
    TrackingActionSource,
    TrackingActionSourceMeta,
    TrackingType,
} from '~/@types/tracking';

@Component({
    name: 'DocumentContextMenu',
    computed: {
        TrackingActionSourceMeta() {
            return TrackingActionSourceMeta;
        },
    },
    components: {
        InterfaceTimeRewind,
        InterfaceBookmark,
        AddExistingClipIntegrationSelector,
        PageStatusControls,
        PageDatePickerDropdown,
        InterfaceLink,
        InterfaceCalendar,
        InterfaceAlertInformationCircle,
        InterfaceContentArchive,
        InterfaceDownloadSquare,
        InterfaceEditPin2,
        ProjectSelector,
        ProjectEditor,
        InterfaceDeleteBin1,
        InterfaceEditPencil,
        InterfaceArrowsBendRight1Alternate,
        InterfaceShare,
        InterfaceLinkSquare,
        InterfaceFileDoubleAlt,
        InterfaceFileAddAlt,
        InterfaceUnlink,
        DropdownButton,
    },
})
export default class DocumentContextMenu extends Vue {
    @Prop()
    tabId!: string;

    @Prop()
    id!: string;

    @Prop({ default: '' })
    invokeFrom!: 'header' | 'sidebar';

    @Prop({ default: undefined })
    source!: TrackingActionSource | undefined;

    moveMode: boolean = false;
    renameMode: boolean = false;
    pickingDate: boolean = false;

    get document() {
        return this.$store.getters['document/byId'](this.id) ?? {};
    }

    get entity() {
        return this.$store.getters['integrationData/byId'](this.document?.clip);
    }

    get hasClip() {
        return this.$entities.page.hasClip(this.document);
    }

    get moving() {
        return this.moveMode && !this.renameMode && !this.pickingDate;
    }

    get renaming() {
        return !this.moveMode && this.renameMode && !this.pickingDate;
    }

    get scheduling() {
        return !this.moveMode && !this.renameMode && this.pickingDate;
    }

    get isBasicContextMenu() {
        return !this.moving && !this.renaming && !this.scheduling;
    }

    get showSidebarTabControls() {
        return this.isBasicContextMenu && this.invokeFrom === 'sidebar';
    }

    get showInfoPanelToggle() {
        return (
            this.invokeFrom === 'header' &&
            this.isBasicContextMenu &&
            !this.document.template
        );
    }

    get notLocal() {
        return this.$store.getters['vault/type'] === 'remote';
    }

    get alwaysShowInfoPanel() {
        return this.$store.getters['appSettings/editorOptions'].showInfoPanel;
    }

    pickDate() {
        this.pickingDate = true;
    }

    removeClip() {
        this.$entities.page.removeClip(this.document.id);
        this.$emit('close');

        this.$tracking.trackEventV2(TrackingType.PAGE, {
            action: TrackingAction.REMOVE_CLIP,
            source: this.source,
            entityId: this.document.id,
        });
    }

    toggleInfoPanel() {
        this.$emit('close');
        this.$store.dispatch('appSettings/updateEditorOptions', {
            showInfoPanel: !this.alwaysShowInfoPanel,
        });
        this.$nuxt.$emit(
            `toggle-panel-${this.tabId}`,
            'page',
            null,
            TrackingActionSource.DROPDOWN,
        );
        
    }

    openInFinder() {
        if (!isElectron() || !this.document.filepath) return;

        (window as SafeElectronWindow).electron.showItemInFolder(
            this.document.filepath,
        );
        this.$emit('close');
    }

    async createPageFromTemplate() {
        this.$emit('close');
        await this.$utils.page.createPageFromTemplate(this.document);
    }

    async duplicateDocument() {
        this.$emit('close');
        const id = await this.$utils.page.duplicatePage(this.document);
        this.$tracking.trackEventV2(TrackingType.PAGE, {
            action: TrackingAction.CREATE,
            source: TrackingActionSource.DUPLICATE,
            entityId: id,
        });
    }

    async templateFromPage() {
        this.$emit('close');
        await this.$utils.page.templateFromPage(this.document);
    }

    deleteTemplate() {
        this.$emit('close');
        this.$utils.page.deleteTemplate(this.document);
    }

    async archiveDocument() {
        this.$emit('close');
        await this.$utils.page.archivePage(this.document);
        this.$tracking.trackEventV2(TrackingType.PAGE, {
            action: TrackingAction.ARCHIVE,
            source: this.source,
            entityId: this.id,
        });
    }

    async restoreDocument() {
        this.$emit('close');
        await this.$utils.page.restorePage(this.document);
        this.$tracking.trackEventV2(TrackingType.PAGE, {
            action: TrackingAction.RESTORE_FROM_ARCHIVE,
            source: this.source,
            entityId: this.id,
        });
    }

    async pin() {
        this.$emit('close');
        await this.$utils.page.pinPage(this.document);
        this.$tracking.trackEventV2(TrackingType.PAGE, {
            action: TrackingAction.PIN,
            source: this.source,
            entityId: this.document.id,
        });
    }

    async unpin() {
        this.$emit('close');
        await this.$utils.page.unpinPage(this.document);
        this.$tracking.trackEventV2(TrackingType.PAGE, {
            action: TrackingAction.UN_PIN,
            source: this.source,
            entityId: this.document.id,
        });
    }

    deleteForever() {
        this.$emit('close');
        this.$utils.page.deletePage(this.document);
        this.$tracking.trackEventV2(TrackingType.PAGE, {
            action: TrackingAction.DELETE,
            source: this.source,
            entityId: this.id,
        });
    }

    showVersionsModal() {
        this.$tracking.trackEventV2(TrackingType.VERSION_HISTORY, {
            action: TrackingAction.OPEN,
            source: this.source,
            entityId: this.id,
        });

        this.$emit('close');
        this.$vfm.show({
            component: () => import('~/components/modal/PageVersionsModal.vue'),
            bind: {
                id: this.id,
            },
        });
    }

    handleProjectSelectorClose() {
        this.$emit('close');
        this.moveMode = false;
        this.renameMode = false;
    }

    shareDocument() {
        this.$emit('close');
        this.$utils.page.sharePage(this.document);
    }

    async exportMarkdown() {
        if (!this.document) return;

        const content = await this.$serviceRegistry.invoke<string[]>(
            ServiceKey.UTILS,
            UtilActions.PARSE_HTML_TO_MD,
            {
                vaultId: this.$store.getters['vault/active']?.id,
                entity: [{ content: this.document.content }],
                callerContext: 'DocumentContextMenu.vue exportMarkdown',
            },
        );

        if (!content || !content.length) return;

        const blob = new Blob(content as BlobPart[], {
            type: 'text/plain;charset=utf-8',
        });
        saveAs(blob, `${this.document.title || 'Untitled'}.md`);

        this.$emit('close');
        await this.$utils.page.exportMarkdown(this.document);
    }
}
</script>

<style lang="scss" scoped>
.document-context-menu {
    @include frostedGlassBackground;
    @include contextMenu;

    &.moving {
        min-width: 270px;
    }
}
</style>
