<template>
    <node-view-wrapper
        as="span"
        style="white-space: nowrap"
        @mousedown.native="handleMouseDown"
    >
        <img class="ProseMirror-separator" /><span
            v-if="open"
            ref="link"
            class="inline-document-link open"
            :class="{ 'has-focus': selected, 'read-only': !editor.isEditable }"
            ><InterfaceContentFileAlternate size="16" class="icon" /><span
                class="inline-document-link--wrapper"
                ><span
                    ref="shadow"
                    class="inline-document-link--shadow"
                    style="max-width: 473px !important; overflow: hidden"
                    >{{ shadowValue }}</span
                ><input
                    ref="input"
                    type="text"
                    :value="value"
                    style="width: 0; max-width: 473px !important"
                    :placeholder="placeholder"
                    @keydown.down.prevent="handleKeyDown"
                    @keydown.up.prevent="handleKeyUp"
                    @keydown.esc.prevent="removeLink"
                    @keydown.backspace.stop="handleBackspace"
                    @input="handleInput($event.target.value)"
                    @keydown.enter.shift.prevent.exact="
                        handleEnter(true, $event)
                    "
                    @keydown.enter.prevent.exact="handleEnter(false, $event)"
                    @keydown.tab.prevent="handleEnter(false, $event)"
                    @blur="handleBlur"
                />
            </span>
        </span>
        <span
            v-else-if="documentExists"
            class="inline-document-link"
            style="white-space: nowrap"
            :class="{
                'has-focus': selected || previewOpen,
                'read-only': !editor.isEditable,
            }"
            @click="navigate"
            @mouseup.middle.stop.prevent="navigate"
            @mouseover="handleMouseOver"
            @mouseleave.self="handleMouseLeave"
            @mousemove="handleMouseMove"
            ><span v-if="document && document.icon" class="custom-icon"
                ><span>{{ document.icon }}</span></span
            ><InterfaceFavoriteStar
                v-else-if="document && document.dailyDoc"
                size="16"
                class="icon" /><InterfaceContentFileAlternate
                v-else
                size="16"
                class="icon" /><span
                class="inline-document-link--name"
                style="white-space: normal"
                >{{ $entities.page.displayTitle(document)
                }}<component
                    :is="statusIcon.icon"
                    v-if="documentExists && document.pageStatus"
                    :style="{ color: statusIcon.color }" /></span></span
        ><span
            v-else
            class="inline-document-link"
            style="white-space: nowrap"
            :class="{
                'has-focus': selected || previewOpen,
                'read-only': !editor.isEditable,
            }"
            @click="navigate"
            @mouseup.middle.stop.prevent="navigate"
            ><InterfaceContentFileAlternate size="16" class="icon" /><span
                class="inline-document-link--name"
                style="white-space: normal"
                >{{ node.attrs.title }}</span
            ></span
        ><img class="ProseMirror-separator" />
    </node-view-wrapper>
</template>

<script lang="ts">
import { Component, Inject, Watch } from 'vue-property-decorator';
import { NodeViewProps, nodeViewProps, NodeViewWrapper } from '@tiptap/vue-2';
import { Node } from '@tiptap/pm/model';
import { parse } from 'date-fns';
import { v4 } from 'uuid';
import { IDocument } from '~/components/document/model';
import InlineDocumentSuggestions from '~/components/editor/extensions/inline-document-link/InlineDocumentLinkSuggestions.vue';
import DocumentLinkPreviewMixin from '~/mixins/DocumentLinkPreviewMixin.vue';
import {
    SearchIndex,
    SearchServiceAction,
    ServiceKey,
    TabType,
} from '~/constants';
import InterfaceContentFileAlternate from '~/components/streamline/InterfaceContentFileAlternate.vue';
import InterfaceFavoriteStar from '~/components/streamline/InterfaceFavoriteStar.vue';
import PageStatusComponent from '~/components/entities/page/PageStatusComponent.vue';
import { TabSymbols } from '~/constants/symbols';
import {
    TrackingAction,
    TrackingActionSource,
    TrackingActionSourceMeta,
    TrackingType,
} from '~/@types/tracking';
import { GithubIntegrationDataType } from '~/components/github/github';

@Component({
    name: 'InlineDocumentLink',
    components: {
        PageStatusComponent,
        InterfaceFavoriteStar,
        InterfaceContentFileAlternate,
        NodeViewWrapper,
    },
    props: nodeViewProps,
})
export default class InlineDocumentLink extends DocumentLinkPreviewMixin {
    open: boolean = true;
    node!: Node;
    getPos!: any;
    editor!: NodeViewProps['editor'];
    selected!: NodeViewProps['selected'];
    value: string = '';
    shadowValue: string = '';
    placeholder: string = 'Link page';
    selectedIndex: number = 0;
    updateAttributes!: any;
    canBlur: boolean = true;
    deleteNode!: NodeViewProps['deleteNode'];
    origin: 'autocomplete' | 'markdown' = 'markdown';

    $refs!: {
        shadow: HTMLSpanElement;
        input: HTMLInputElement;
        popup: HTMLDivElement;
        link: HTMLSpanElement;
    };

    @Inject({ from: TabSymbols.TAB_ID, default: null })
    tabId!: string | null;

    get tabType() {
        const id = this.tabId as string;
        const tab = this.$entities.tab.byId(id);

        if (tab) {
            return tab.type;
        }
        return 'Unknown';
    }

    get statusIcon() {
        return this.$utils.page.getWorkflowIcon(this.document?.pageStatus);
    }

    get document() {
        const { id } = this.node.attrs;
        return this.$store.getters[`document/byId`](id);
    }

    get documentExists() {
        return this.$entities.vault.pagesLoaded && !!this.document;
    }

    get documentId() {
        return this.document?.id;
    }

    get nextLevel() {
        if (!this.$route.query.level) return null;
        return +this.$route.query.level + 1;
    }

    handleMouseDown(e: MouseEvent) {
        if (this.$utils.isMobile) {
            e.preventDefault();
        }
    }

    @Watch('document', { immediate: true })
    handleDocumentChange(doc: IDocument | null) {
        if (!doc && !this.$entities.vault.pagesLoaded) return;
        if (!doc) return;

        const pageTitle = this.$entities.page.displayTitle(doc);
        if (pageTitle === this.node.attrs.title) return;
        this.updateAttributes({
            title: pageTitle,
        });
    }

    handleBlur() {
        if (!this.canBlur) return;
        this.removeLink();
    }

    handleEnter(shift: boolean = false, event?: KeyboardEvent) {
        if (event && event.isComposing && !this.$utils.isMobile) return;
        if (!this.value.trim().length) {
            this.canBlur = true;
            return;
        }
        this.canBlur = false;
        this.handleDocumentSelect(this.results[this.selectedIndex], shift);
    }

    handleClick() {
        this.canBlur = false;
        this.handleDocumentSelect(this.results[this.selectedIndex], false);
    }

    async navigate(event: MouseEvent) {
        if (!this.editor.isEditable) return;
        if (!this.document && !this.$entities.vault.pagesLoaded) {
            return;
        }
        let id = this.node.attrs.id;

        if (!this.document) {
            const pageObj = {
                id: v4(),
                title: this.node.attrs.title,
            };
            await this.$entities.page.create(pageObj);
            this.updateAttributes({
                id: pageObj.id,
            });
            id = pageObj.id;
        }

        if (this.$utils.isMobile) {
            this.$router.push({
                path: `/mobile/documents/${id}`,
                query: {
                    level: `${this.nextLevel}`,
                },
            });
            this.$tracking.trackEventV2(TrackingType.PAGE, {
                action: TrackingAction.OPEN,
                source: TrackingActionSource.BACKLINK_EDITOR,
                sourceMeta:
                    this.$router.currentRoute.name === 'index'
                        ? TrackingActionSourceMeta.MY_DAY
                        : TrackingActionSourceMeta.PAGE,
            });
            return;
        }
        const document = this.$store.getters['document/byId'](id);

        const sourceMeta =
            this.tabType === TabType.DOCUMENT
                ? TrackingActionSourceMeta.PAGE
                : TrackingActionSourceMeta.MY_DAY;

        if (document.dailyDoc) {
            this.$tracking.trackEventV2(TrackingType.MY_DAY, {
                action: TrackingAction.OPEN,
                source: TrackingActionSource.BACKLINK_EDITOR,
                sourceMeta,
            });
            return this.$entities.myDay.open({
                event,
                data: {
                    date: parse(document.dailyDoc, 'yyyy-MM-dd', new Date()),
                },
            });
        }

        this.$tracking.trackEventV2(TrackingType.PAGE, {
            action: TrackingAction.OPEN,
            source: TrackingActionSource.BACKLINK_EDITOR,
            sourceMeta,
        });
        const tab = this.$tabs.createNewTabObject(id, TabType.DOCUMENT);
        this.$tabs.openTabWithEvent(tab, event);
    }

    async createNewDocument(doc: IDocument) {
        const id = await this.$utils.page.newPage(doc);
        return id;
    }

    async handleDocumentSelect(doc: IDocument, redirect: boolean = false) {
        let docId = doc.id;
        const isPhantomDailydoc =
            doc.dailyDoc &&
            this.$store.getters['document/byDailyDoc'](doc.dailyDoc) === null;
        if (doc.id === '' || doc.id === 'new' || isPhantomDailydoc) {
            docId = await this.createNewDocument(doc);
            const sourceMeta =
                this.tabType === TabType.DOCUMENT
                    ? TrackingActionSourceMeta.PAGE
                    : TrackingActionSourceMeta.MY_DAY;
            this.$tracking.trackEventV2(TrackingType.PAGE, {
                action: TrackingAction.CREATE,
                source: TrackingActionSource.BACKLINK_EDITOR,
                sourceMeta,
                entityId: docId,
            });
        }
        this.updateAttributes({
            id: docId,
        });
        this.open = false;
        this.$dropdown.hideAll();
        this.editor.commands.focus(this.getPos() + 1);
        if (redirect) {
            if (this.$utils.isMobile) {
                this.$router.push({
                    path: `/mobile/documents/${doc.id}`,
                    query: {
                        level: `${this.nextLevel}`,
                    },
                });
                this.$tracking.trackEventV2(TrackingType.EDITOR, {
                    action: TrackingAction.INSERT_PAGE_LINK,
                    source:
                        this.origin === 'autocomplete'
                            ? TrackingActionSource.AUTOCOMPLETE
                            : TrackingActionSource.MARKDOWN,
                    sourceMeta:
                        this.$router.currentRoute.name === 'index'
                            ? TrackingActionSourceMeta.MY_DAY
                            : TrackingActionSourceMeta.PAGE,
                });
                return;
            }
            const tab = this.$tabs.createNewTabObject(docId, TabType.DOCUMENT);
            this.$tabs.openTab(tab);
        }
        this.$tracking.trackEvent('editor', {
            action: 'insert page link',
        });

        if (this.tabType === 'Unknown') return;
        this.$tracking.trackEventV2(TrackingType.EDITOR, {
            action: TrackingAction.INSERT_PAGE_LINK,
            source:
                this.origin === 'autocomplete'
                    ? TrackingActionSource.AUTOCOMPLETE
                    : TrackingActionSource.MARKDOWN,
            sourceMeta:
                this.tabType === TabType.MY_DAY
                    ? TrackingActionSourceMeta.MY_DAY
                    : TrackingActionSourceMeta.PAGE,
        });
    }

    results: IDocument[] = [];

    @Watch('value')
    async setResults() {
        if (!this.value.length) return [];
        const activeVault = this.$store.getters['vault/active'];
        const results =
            (await this.$serviceRegistry
                .invoke<{ documents: IDocument[] }>(
                    ServiceKey.SEARCH,
                    SearchServiceAction.QUERY,
                    {
                        query: this.value,
                        options: {
                            fields: ['title', 'date'],
                            activeVault,
                            thisVaultOnly: true,
                            entity: [SearchIndex.DOCUMENT],
                            limit: 5,
                        },
                    },
                )
                .then(data => data?.documents)
                .catch(() => this.results)) ?? [];

        this.results = [...results, ...this.createNewDoc];
    }

    get createNewDoc(): IDocument[] {
        if (this.value.trim().length > 0) {
            return [{ id: 'new', title: this.value.trim() } as IDocument];
        }
        return [];
    }

    createPopper() {
        this.$dropdown.hideAll();
        if (this.value.trim().length === 0 || !this.open) return;
        this.$dropdown.show({
            parent: this.$refs.link,
            component: InlineDocumentSuggestions,
            retainFocus: true,
            backdrop: false,
            popperOptions: {
                modifiers: [
                    {
                        name: 'flip',
                        options: {
                            fallbackPlacements: ['top-start'],
                            boundary: document.getElementById('editor-wrapper'),
                        },
                    },
                ],
            },
            bind: {
                'selected-index': this.selectedIndex,
                results: this.results,
            },
            on: {
                select: () => {
                    this.handleClick();
                },
                'select:index': (index: number) => {
                    this.selectedIndex = index;
                },
            },
        });
    }

    @Watch('value')
    @Watch('selectedIndex')
    handleSelectedIndexChange() {
        this.createPopper();
    }

    @Watch('results')
    handleResultsChange(curr: any[]) {
        this.createPopper();
        if (this.selectedIndex >= curr.length && curr.length > 0) {
            this.selectedIndex = curr.length - 1;
        }
    }

    handleKeyDown() {
        if (this.results.length === 0) return;
        if (this.selectedIndex === this.results.length - 1) {
            this.selectedIndex = 0;
        } else {
            this.selectedIndex++;
        }
    }

    handleKeyUp() {
        if (this.results.length === 0) return;
        if (this.selectedIndex === 0) {
            this.selectedIndex = this.results.length - 1;
        } else {
            this.selectedIndex--;
        }
    }

    handleBackspace() {
        if (this.value === '') {
            this.removeLink();
        }
    }

    handleInput(value: string) {
        this.shadowValue = value.length === 0 ? this.placeholder : value;
        this.value = value;
        this.recalculateHeight();
    }

    get id() {
        const id = this.node.attrs.id;
        return id;
    }

    recalculateHeight() {
        this.$nextTick(() => {
            const width = this.$refs.shadow.offsetWidth!;
            this.$refs.input.style.width = `${Math.min(width, 473)}px`;
        });
    }

    removeLink() {
        this.canBlur = false;
        this.$dropdown.hideAll();
        const from = this.editor.state.selection.from - 1;
        this.editor
            .chain()
            .insertContentAt(from, '[[')
            .focus(from + 2)
            .run();
        this.deleteNode();
    }

    mounted() {
        const { value, origin } = this.node.attrs;
        if (origin) {
            this.origin = origin;
        }
        this.value = value;
        this.shadowValue = value.length === 0 ? this.placeholder : value;
        if (this.node.attrs.id === 'new') {
            this.open = true;
            this.$nextTick(() => {
                this.recalculateHeight();
                this.$refs.input.focus({
                    preventScroll: true,
                });
            });
        } else {
            this.open = false;
        }
    }
}
</script>

<style lang="scss" scoped>
.has-focus[data-node-view-wrapper] .ProseMirror-separator,
.has-focus[data-node-view-wrapper] {
    user-select: none;
}

.inline-document-link {
    position: relative;
    border-radius: 6px;
    cursor: default;
    -webkit-box-decoration-break: clone;
    -o-box-decoration-break: clone;
    box-decoration-break: clone;
    background: var(--editor-extension-document-link-bg-color);
    padding: 3px 4px;

    &.open {
        padding-top: 3px;
    }

    &--wrapper {
        display: inline-flex;
    }

    &:hover:not(.open):not(.read-only),
    &.has-focus:not(.read-only) {
        background: var(--editor-extension-document-link-bg-color__hover);
        user-select: none;
        border: 2px solid var(--accent-color);
        padding: 1px 2px;

        .icon {
            color: var(--editor-extension-document-link-icon-color__hover);
        }
    }

    &__archived-tooltip {
        visibility: hidden;
        text-size-adjust: auto;
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1;
    }

    &:hover &__archived-tooltip {
        visibility: visible;
    }

    > .custom-icon {
        width: 16px;
        height: 16px;
        font-size: 14px;
        margin-right: 4px;
        display: inline-block;
        line-height: 20px;

        span {
            font-size: 14px;
            line-height: 20px;
            font-family: 'Apple Color Emoji', 'Segoe UI Emoji', NotoColorEmoji,
                'Noto Color Emoji', 'Segoe UI Symbol', 'Android Emoji',
                EmojiSymbols, serif;
        }
    }

    &--name {
        & > svg {
            display: inline;
            margin: 0 4px 4px;
        }
    }

    > .icon {
        color: var(--editor-extension-document-link-icon-color);
        position: relative;
        top: -2px;
        display: inline;
        width: 16px;
        height: 16px;
        margin-right: 4px;
    }

    &--shadow {
        position: absolute;
        visibility: hidden;
        white-space: pre;
        overflow: visible;
    }

    input {
        outline: none;
        font-size: 16px;

        &::placeholder {
            color: var(--editor-extension-placeholder-color);
        }
    }
}
</style>
