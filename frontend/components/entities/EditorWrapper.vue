<template>
    <div ref="document" class="editor-wrapper">
        <div class="editor-wrapper--content">
            <div
                ref="editorInnerWrapper"
                class="editor-wrapper--content--inner--wrapper"
                @mouseup="handleMouseUp"
                @mousedown="handleMouseDown"
            >
                <div class="editor-wrapper--content--inner" :style="{ maxWidth: isWideEditor ? '100%' : contentWidth + 'px' }">
                    <Editor
                        ref="editor"
                        :value="editorDocument.content"
                        :doc-id="editorDocument.id"
                        :tab-id="tabId"
                        :group-id="groupId"
                        :placeholder="placeholder"
                        @keyUp="handleKeyUp"
                        @update:html="onUpdateHtmlHandler"
                        @update:tab-data="updateTabData($event)"
                        @scroll-to-bottom="$emit('scroll-to-bottom')"
                        @editor:ready="handleEditorReady"
                    />
                </div>
            </div>
            <div
                class="editor-wrapper--footer"
                @click="focusEditor('end')"
            ></div>
        </div>
    </div>
</template>

<script lang="ts">
import {
    Vue,
    Component,
    Watch,
    Prop,
    InjectReactive,
    Inject,
} from 'vue-property-decorator';
import { FocusPosition } from '@tiptap/core';
import { v4 } from 'uuid';
import scrollIntoView from 'scroll-into-view';
import { IDocument } from '~/components/document/model';
import type EditorComponent from '~/components/editor/EditorComponent.vue';
import { TabSymbols } from '~/constants/symbols';
import { ITask } from '~/components/task/model';
import { es } from 'chrono-node';
import { is } from 'date-fns/locale';

@Component({
    name: 'EditorWrapper',
    components: {
        Editor: () => import('~/components/editor/EditorComponent.vue'),
    },
})
export default class EditorWrapper extends Vue {
    @Inject(TabSymbols.TAB_ID)
    tabId!: string;

    @Inject(TabSymbols.ENTITY_ID)
    entityId!: string;

    @Inject(TabSymbols.TAB_GROUP_ID)
    groupId!: string;

    @Inject(TabSymbols.GET_SCROLL_POSITION)
    getScrollPosition!: (label?: string) => any;

    @Prop({ required: true })
    placeholder!: string;

    @Prop({ type: Boolean, default: false })
    isWideEditor!: boolean;

    mouseDownElement: HTMLElement | null = null;
    childEditor: any = null;
    editorDocument: Partial<IDocument> = {};

    $refs!: {
        editor: EditorComponent;
        document: HTMLElement;
        editorInnerWrapper: HTMLElement;
    };

    get isActive() {
        return this.tabId === this.$utils.navigation.activeTabId;
    }

    get notificationTasks() {
        // return [];
        return this.$store.getters['tasks/byDocumentId'](
            this.editorDocument.id,
        ).filter((task: ITask) => task?.updateNotification);
    }

    get tabData() {
        return this.$store.getters['tabs/byId'](this.tabId)?.data ?? {};
    }

    blurEditor() {
        this.$refs.editor?.editorInstance?.commands.blur();
    }

    get document() {
        return (
            this.$store.getters['document/byId'](this.entityId) ??
            this.$store.getters['document/byClip'](this.entityId) ??
            {}
        );
    }

    get contentWidth() {
        return this.$store.getters['appSettings/editorOptions'].contentWidth;
    }

    get editor() {
        return this.$refs.editor?.editorInstance;
    }

    get editorId() {
        return this.$refs.editor?.editor?.context.editorId;
    }

    focusEditor(pos: FocusPosition = 'start') {
        this.$emit('focus-tab');
        this.$refs.editor?.focusEditor(pos);
    }

    handleKeyUp() {
        this.$nuxt.$emit(`focus-title-${this.tabId}`);
    }

    @Watch('document.content')
    handleContentChange() {
        // @ts-ignore
        if (this.document.editorId === this.editorId) return;
        this.editorDocument =
            this.$store.getters['document/byId'](this.document.id) || {};
    }

    @Watch('document.updateId')
    handleRemoteUpdate() {
        let shouldFocusPreviousPosition = false;
        let lastFocusPosition: any = 0;
        if (this.editorDocument.id === this.document.id) {
            shouldFocusPreviousPosition = true;
            lastFocusPosition = this.$refs.editor?.editor?.lastFocusPosition;
        }
        this.editorDocument =
            this.$store.getters['document/byId'](this.document.id) || {};
        if (shouldFocusPreviousPosition && this.$store.getters.editorFocused) {
            if (this.groupId !== this.$store.getters['tabs/activeGroup']?.id) {
                return;
            }
            this.$nextTick(() => {
                this.$emit('focus-tab');
                this.$refs.editor?.focusEditor(lastFocusPosition);
            });
        }
    }

    @Watch('document.id')
    handleDocumentIdChange(newVal: string) {
        this.editorDocument =
            this.$store.getters['document/byId'](newVal) ?? {};
        if (this.$refs.editor?.editor) {
            this.$refs.editor.editor.lastFocusPosition = 0;
        }

        if (this.editorDocument.content) {
            this.$refs.editor?.clearHistory(this.editorDocument.content);
        }
    }

    handleMouseUp(event: MouseEvent) {
        if (this.$config.platform === 'mobile') return;
        if (!this.$refs.editor) return;

        const mx = event.pageX;
        const my = event.pageY;
        const {
            top: editorY,
            left: editorX,
            right: editorXX,
        } = this.$refs.editor.$el.getBoundingClientRect();
        const editorMid = editorX + (editorXX - editorX) / 2;

        if (this.mouseDownElement?.isEqualNode(this.$refs.editorInnerWrapper)) {
            this.$emit('focus-tab');
            if (my <= editorY) {
                if (mx < editorMid) {
                    this.$nextTick(() => {
                        this.$nuxt.$emit(`focus-title-${this.tabId}`, 'start');
                    });
                } else {
                    this.$nextTick(() => {
                        this.$nuxt.$emit(`focus-title-${this.tabId}`, 'end');
                    });
                }

                return;
            } else {
                this.$refs.editor?.focusEditorAtCoords(
                    mx < editorMid ? editorX : editorXX,
                    my,
                );
            }
        }

        this.mouseDownElement = null;
    }

    handleMouseDown(e: Event) {
        if (this.$config.platform === 'mobile') return;
        const target = e.target as HTMLElement;
        this.mouseDownElement = target;
    }

    onUpdateHtmlHandler(html: string) {
        const activeTab = this.$utils.navigation.activeTab;
        if (
            this.groupId !== this.$store.getters['tabs/activeGroup']?.id &&
            activeTab.entityId === this.editorDocument.id
        ) {
            return;
        }
        const id = this.editorDocument.id;
        if (this.$store.getters['document/byId'](id)?.archived) return;
        this.$store.dispatch('document/update', {
            id,
            content: html,
            updatedAt: new Date(),
            editorId: this.editorId,
        });
    }

    checkTaskId(): string | null {
        return (this.$route.query.f as string) ?? null;
    }

    focusTitle() {
        // Nasty hack but title editor is mounted AFTER this call.
        setTimeout(() => {
            this.$nuxt.$emit(`focus-title-${this.tabId}`, 'end');
        }, 50);
    }

    smartFocus() {
        if (!this.isActive || this.getScrollPosition('editor')) return;
        this.$emit('focus-tab');
        this.childEditor = this.$refs.editor?.editorInstance;

        const id = this.editorDocument?.id;
        if (!id) return;
        const document = this.$store.getters['document/byId'](id);
        if (!document) return;

        const content = this.editorDocument.content;
        const title = this.editorDocument.title;
        if (!title) {
            this.focusTitle();
            return;
        }
        if ((!content || content === '<p></p>') && !this.editorDocument?.clip) {
            this.focusTitle();
        } else {
            const taskId = this.checkTaskId();
            if (taskId) {
                this.$nextTick(() => {
                    this.$refs.editor?.focusTask(taskId);
                });
            } else {
                this.focusEditor('start');
            }
        }
    }

    updateTabData(data: any) {
        this.$emit('update-tab-data', data);
    }

    async handleNewDocument() {
        let sharingUuid = null;
        const projectId = this.tabData?.projectId;
        if (projectId) {
            const project = this.$entities.folder.byId(projectId);

            if (project && project.sharingUuid) {
                sharingUuid = v4();
            }
        }
        const document = this.$store.getters['document/byId'](this.entityId);
        if (!document) {
            await this.$store.dispatch('document/new', {
                id: this.entityId,
                projectId,
                sharingUuid,
                title: '',
                content: '<p></p>',
                status: 'new',
                updatedAt: new Date(),
                createdAt: new Date(),
                template: this.tabData?.template,
            });
        }
    }

    beforeDestroy() {
        this.$nuxt.$off(`smart-focus-${this.tabId}`, this.smartFocus);
        this.$nuxt.$off(`title-keydown-${this.tabId}`, this.focusEditor);
    }

    created() {
        this.handleNewDocument();
    }

    @Watch('tabData.match', { deep: true })
    async handleMatchChange() {
        let match = null;
        if (!this.tabData.match) return;

        match = Object.entries<string[]>(this.tabData.match)
            .filter(([_, value]) => value.includes('content'))
            .shift()?.[0];
        if (!match) return;

        await this.$nextTick();
        const pos = this.$refs.editor?.editor?.utils.findTextPosition(match);
        if (!pos) return;

        const node = this.$refs.editor.editorInstance?.view.domAtPos(pos)
            .node as HTMLElement;

        if (!node || !node.getBoundingClientRect?.()) {
            this.updateTabData({ match: undefined });
            return;
        }

        scrollIntoView(node, {
            time: 250,
        });
        setTimeout(() => {
            this.$refs.editor.editorInstance
                ?.chain()
                .setTextSelection({ from: pos, to: pos + match.length })
                .run();
        }, 400);
        this.updateTabData({ match: undefined });
    }

    handleEditorReady() {
        this.handleMatchChange();
        if (this.tabData?.focus) {
            this.$nuxt.$emit(`focus-task:${this.tabData?.focus}`);
            this.updateTabData({ focus: null });
        }
    }

    mounted() {
        if (this.document) {
            this.handleDocumentIdChange(this.document.id);
        }

        this.$nuxt.$on(`smart-focus-${this.tabId}`, this.smartFocus);
        this.$nuxt.$on(`title-keydown-${this.tabId}`, this.focusEditor);
        this.$nuxt.$on(`page-restore-${this.tabId}`, () =>
            this.handleDocumentIdChange(this.document.id),
        );
    }
}
</script>
<style lang="scss" scoped>
.editor-wrapper {
    width: 100%;
    height: 100%;

    &--content {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        padding: 0px 30px 0px;

        &--inner {
            width: 100%;
            margin: 0 auto;

            &--wrapper {
                padding-top: 20px;
            }

        }

        &.wide-editor {
            max-width: 100%;
        }
    }

    &--footer {
        height: 100%;
        cursor: text;
        min-height: 200px;
    }
}
</style>
