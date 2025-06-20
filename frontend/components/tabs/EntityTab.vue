<template>
    <div class="entity" @mousedown="$emit('focus-tab')">
        <div
            class="entity--wrapper"
            :class="{
                'narrow-editor': !isWideEditor,
                animate,
                'entity--wrapper__panel-open':
                    isPanelOpen && !shouldDetachPanel,
                'entity--wrapper__panel-open__detached':
                    isPanelOpen && shouldDetachPanel,
            }"
        >
            <div
                class="entity--wrapper--search"
                :class="{
                    'single-tab': isSingleTab,
                    'panel-open': isPanelOpen && !shouldDetachPanel,
                }"
            >
                <SearchBar @update:tab-data="$emit('data-update', $event)" />
            </div>
            <div
                id="editor-wrapper"
                ref="editorContainer"
                class="entity--wrapper--content tab-content-gutter"
            >
                <div class="entity--wrapper--content--misc">
                    <EntityExtendedProperties/>
                </div>
                <div class="entity--wrapper--content--icon">
                   
                </div>
                <div class="entity--wrapper--content--title" :style="{ width: isWideEditor ? '100%' : contentWidth + 'px' }">
                    <EntityIcon :isWideEditor="isWideEditor" />
                    <EntityTitle
                        ref="entityTitle"
                        :isWideEditor="isWideEditor"
                        @focus-tab="$emit('focus-tab')"
                        @paste:multiline="handleMultilinePaste"
                    />
                </div>
                <div class="entity--wrapper--content--controls">
                    <EntityControls :isWideEditor="isWideEditor" @focus-tab="$emit('focus-tab')" />
                </div>
                <div class="entity--wrapper--content--editor">
                    <EditorWrapper
                        ref="editorWrapper"
                        :isWideEditor="isWideEditor"
                        :placeholder="editorPlaceholder"
                        @focus-tab="$emit('focus-tab')"
                        @update-tab-data="$emit('data-update', $event)"
                        @scroll-to-bottom="scrollToBottom"
                    />
                </div>
            </div>
            <div
                v-if="isPanelOpen"
                class="entity--wrapper--panel"
                :class="{
                    'entity--wrapper--panel__detached': shouldDetachPanel,
                }"
            >
                <EntityPanel
                    @focus-tab="$emit('focus-tab')"
                    @panel:close="closePanel"
                    @heading:click="handleHeadingClick"
                />
            </div>
        </div>
    </div>
</template>
<script lang="ts">
import { Component, Watch } from 'vue-property-decorator';
import { animate } from 'motion';
import isEqual from 'lodash/isEqual';
import TabMixin from '~/components/tabs/TabMixin.vue';
import EntityPanel from '~/components/entities/EntityPanel.vue';
import EditorWrapper from '~/components/entities/EditorWrapper.vue';
import EntityTitle from '~/components/entities/EntityTitle.vue';
import SearchBar from '~/components/editor/extensions/search/SearchBar.vue';
import EntityIcon from '~/components/entities/EntityIcon.vue';
import EntityExtendedProperties from '~/components/entities/EntityExtendedProperties.vue';
import EntityControls from '~/components/entities/EntityControls.vue';
import { PANEL_DETACH_WIDTH } from '~/constants';
import { Tab } from '~/@types/app';
import {
    TrackingAction,
    TrackingActionSource,
    TrackingType,
} from '~/@types/tracking';

@Component({
    name: 'EntityTab',
    components: {
        EntityControls,
        EntityExtendedProperties,
        EntityIcon,
        SearchBar,
        EntityTitle,
        EditorWrapper,
        EntityPanel,
    },
})
export default class EntityTab extends TabMixin<any> {
    animate: boolean = true;
    hasEditor: boolean = true;

    $refs!: {
        entityTitle: EntityTitle;
        editorWrapper: EditorWrapper;
        editorContainer: HTMLDivElement;
    };

    get isWideEditor() {
        return this.$store.getters['appSettings/editorOptions'].wide;
    }

    get isPanelOpen() {
        const storedTab = this.$store.getters['tabs/byId'](this.id);
        return storedTab?.data?.panelOpen ?? false;
    }

    get isSingleTab() {
        return this.$store.getters['tabs/singleTabOpen'];
    }

    get shouldDetachPanel() {
        return this.tabWidth < PANEL_DETACH_WIDTH;
    }

    get editorPlaceholder() {
        return (
            (
                this.$componentsRepository.getEditorPlaceholder(
                    this.entityType,
                    this.id,
                ) as any
            )() ?? 'Type / for commands'
        );
    }

    scrollToBottom() {
        let prev = 0;
        animate(
            progress => {
                const documentDiv = this.$refs.editorContainer;
                if (!documentDiv) return;
                const step = (progress - prev) * 200;
                documentDiv.scrollTop += step;
                prev = progress;
            },
            { duration: 0.15 },
        );
    }

    @Watch('tabWidth')
    onWidthChange(newValue: number, oldValue: number) {
        if (
            oldValue >= PANEL_DETACH_WIDTH &&
            newValue < PANEL_DETACH_WIDTH &&
            this.isPanelOpen
        ) {
            this._closePanel();
        }
    }

    handleMultilinePaste(event: ClipboardEvent) {
        const htmlData = event.clipboardData?.getData('text/html');
        const textData = event.clipboardData?.getData('text/plain');

        if (htmlData) {
            return this.processHtmlPaste(htmlData);
        }
        if (textData) {
            return this.processTextPaste(textData);
        }
    }

    processTextPaste(textData: string) {
        const content = textData.substring(textData.indexOf('\n') + 1);
        this.$refs.editorWrapper?.editor
            ?.chain()
            .insertContentAt(0, content)
            .focus()
            .run();
    }

    processHtmlPaste(htmlString: string) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        const content = doc.body.innerHTML.replace(/<br>/g, '\n').trim();
        let rest = content.split('\n').slice(1).join('\n');
        if (!rest && doc.body.firstElementChild?.tagName) {
            const closingTag = `</${doc.body.firstElementChild?.tagName.toLowerCase()}>`;
            rest = content.slice(
                content.indexOf(closingTag) + closingTag.length,
            );
        }

        const dd = parser.parseFromString(rest, 'text/html');
        const closingTags = rest.replace(dd.body.innerHTML, '');
        const openingTags = closingTags
            .split('</')
            .filter(v => !!v?.trim())
            .map(v => '<' + v)
            .reverse()
            .join('');

        rest = openingTags + dd.body.innerHTML + closingTags;

        this.$refs.editorWrapper?.editor
            ?.chain()
            .insertContentAt(0, rest)
            .focus()
            .run();
    }

    closePanel() {
        this.$tracking.trackEventV2(TrackingType.INFO_PANEL, {
            action: TrackingAction.CLOSE,
            source: TrackingActionSource.INFO_PANEL,
            entityId: this.entityId,
        });
        this._closePanel();
    }

    get panelType() {
        return this.$store.getters['tabs/byId'](this.id).data.panelType;
    }

    get panelData() {
        return this.$store.getters['tabs/byId'](this.id).data.panelData;
    }

    get contentWidth() {
        return this.$store.getters['appSettings/editorOptions'].contentWidth;
    }

    _openPanel(
        panelType: string | null = null,
        panelData: Tab['data']['panelData'] = null,
    ) {
        this.updateTabData({
            panelType,
            panelOpen: true,
            panelData,
        });
    }

    _closePanel() {
        this.updateTabData({
            panelOpen: false,
            panelType: null,
            panelData: null,
        });
    }

    _changePanelType(
        panelType: string,
        panelData: Tab['data']['panelData'] = null,
    ) {
        this.updateTabData({
            panelType,
            panelData,
        });
    }

    togglePanel(
        panelType: string | null = null,
        panelData: Tab['data']['panelData'] = null,
        source: TrackingActionSource,
    ) {
        if (this.document && this.document.template) return;
        const isOpen = this.isPanelOpen;

        if (!isOpen) {
            this.$tracking.trackEventV2(TrackingType.INFO_PANEL, {
                action: TrackingAction.OPEN,
                source,
                entityId: this.entityId,
            });
            this._openPanel(panelType, panelData);
            return;
        }

        if (
            panelType !== this.panelType ||
            !isEqual(panelData, this.panelData)
        ) {
            this._changePanelType(panelType as string, panelData);
            return;
        }

        this.$tracking.trackEventV2(TrackingType.INFO_PANEL, {
            action: TrackingAction.CLOSE,
            source,
            entityId: this.entityId,
        });
        this._closePanel();
    }

    handleHeadingClick() {
        if (!this.shouldDetachPanel) return;

        this.closePanel();
    }

    registerPanelHandlers() {
        this.$nuxt.$on(`toggle-panel-${this.id}`, this.togglePanel);
    }

    unregisterPanelHandlers() {
        this.$nuxt.$off(`toggle-panel-${this.id}`, this.togglePanel);
    }

    beforeDestroy() {
        this.unregisterPanelHandlers();
    }

    mounted() {
        this.registerPanelHandlers();
        this.registerScrollObservable();
    }

    registerScrollObservable() {
        let titleReady = false;
        let editorReady = false;
        const setScroll = () => {
            if (!titleReady || !editorReady) return;
            this.$refs.editorContainer.scrollTop = this.getScrollPosition();
            this.$refs.editorContainer.addEventListener('scroll', (e: any) => {
                this.setScrollPositions(e.target.scrollTop);
            });
        };

        const titleObserver = new MutationObserver((mutationList, observer) => {
            const textArea = mutationList.find(mutation => {
                return (mutation.target as any).type === 'textarea';
            });
            if (!textArea) return;
            titleReady = true;
            setScroll();
            observer.disconnect();
        });
        const editorObserver = new MutationObserver(
            (mutationList, observer) => {
                const editorLoadedMutation = mutationList.find(mutation => {
                    return (
                        mutation.type === 'childList' &&
                        mutation.addedNodes.length &&
                        (
                            mutation.addedNodes[0] as HTMLElement
                        ).classList.contains('ProseMirror')
                    );
                });
                if (!editorLoadedMutation) return;
                editorReady = true;
                setScroll();
                observer.disconnect();
            },
        );

        editorObserver.observe(this.$refs.editorWrapper.$el, {
            subtree: true,
            childList: true,
        });
        titleObserver.observe(this.$refs.entityTitle.$el, {
            subtree: true,
            childList: true,
            attributes: true,
        });
    }
}
</script>
<style>
.panel-enter {
    transform: translateX(403px);
}

.panel-enter-active {
    transition: transform 0.3s cubic-bezier(0, 0.45, 0.2, 1);
}

.panel-enter-to {
    transform: translateX(0px);
}

.panel-leave {
    transform: translateX(0px);
}

.panel-leave-active {
    transition: transform 0.3s cubic-bezier(0.18, 0.62, 0.44, 0.95);
}

.panel-leave-to {
    transform: translateX(403px);
}

.panel-detached-enter {
    transform: translateX(100%);
}

.panel-detached-enter-active {
    transition: transform 0.3s cubic-bezier(0, 0.45, 0.2, 1);
}

.panel-detached-enter-to {
    transform: translateX(0px);
}

.panel-detached-leave {
    transform: translateX(0px);
}

.panel-detached-leave-active {
    transition: transform 0.3s cubic-bezier(0.18, 0.62, 0.44, 0.95);
}

.panel-detached-leave-to {
    transform: translateX(100%);
}
</style>
<style lang="scss">
.entity {
    position: relative;
    width: 100%;
    height: $desktopContentHeight;

    &--wrapper {
        width: 100%;
        overflow-x: hidden;
        position: relative;

        &__panel-open {
            .entity--wrapper--content {
                width: calc(100% - 356px);
            }
        }

        .tab-group__active & {
            @include scrollbar(36px, 9px);
        }

        &--search {
            position: absolute;
            right: 4px;
            top: 36px;
            z-index: 100;

            &.single-tab {
                top: 0;
            }

            &.panel-open {
                right: 354px;
            }
        }

        &--panel {
            //transition: transform 0.3s cubic-bezier(0, 0.45, 0.2, 1);
            position: absolute;
            max-width: 350px;
            width: 100%;
            top: 0;
            right: 0;

            &__detached {
                max-width: 100%;
                height: 100%;
            }
        }

        &--content {
            display: flex;
            flex-direction: column;
            height: $desktopContentHeight;
            width: 100%;
            position: relative;
            overflow-y: overlay;
            overflow-x: hidden;


            &--title {
                display: flex;
                flex-direction: row;
                flex-wrap: wrap;
                align-items: center;
                margin: 0 auto;
                
            }

            &--editor {
                height: 100%;
            }

            .animate & {
                //transition: width 0.3s cubic-bezier(0, 0.45, 0.2, 1);
            }

            &--controls {
                padding: 0 30px;
            }

            @include scrollbar(3px, 9px);

            .tab-group__active & {
                @include scrollbar(34px, 9px);
            }
        }
    }
}
</style>
