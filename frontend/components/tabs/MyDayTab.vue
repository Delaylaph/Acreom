<template>
    <div class="my-day page" @mousedown="$emit('focus-tab')">
        <tippy
            :content="$utils.tooltip.getRefText"
            :delay="[100, 20]"
            :offset="`0, 0`"
            :touch="false"
            boundary="window"
            placement="top"
            theme="tooltip"
            target=".has-tippy"
        />
        <div
            class="my-day--search"
            :class="{
                'single-tab': isSingleTab,
                'panel-open': isTimelineOpen && !shouldDetachTimeline,
            }"
        >
            <SearchBar @update:tab-data="updateTabData" />
        </div>
        <div class="my-day--content">
            <div
                id="editor-wrapper"
                ref="document"
                class="my-day--content--wrapper tab-content-gutter"
                :class="{
                    narrow: groupWidth < 768,
                    'my-day--content--wrapper__panel-open':
                        isTimelineOpen && !shouldDetachTimeline,
                    'my-day--content--wrapper__panel-open__detached':
                        isTimelineOpen && shouldDetachTimeline,
                }"
                @mouseup="handleMouseUp"
                @mousedown="handleMouseDown"
            >
                <div
                    class="my-day--content--editor"
                    :class="{
                        'wide-editor': isWideEditor,
                        'single-tab': isSingleTab,
                    }"
                    :style="{ maxWidth: isWideEditor ? '100%' : contentWidth + 'px' }"
                >
                
                    <div
                        ref="myDayHeader"
                        class="my-day--content--editor--header"
                    >
                        <MyDayHeaderControls
                            ref="headerControls"
                            class="my-day--content--editor--header--controls"
                            :overview-date="overviewDate"
                            :now="now"
                            :panel-open="isTimelineOpen"
                            @previous="setPreviousDayButton"
                            @next="setNextDayButton"
                            @today="setTodayButton"
                            @scroll-top="scrollToTop"
                            @toggle-timeline="toggleTimelineButton"
                        />

                        <div class="my-day--content--editor--header--title">
                            <button
                                class="
                                    my-day--content--editor--header--title--date-pick
                                "
                                @click="openCalendarDropdown"
                            >
                                <h2
                                    :class="{
                                        'review-open': isToday,
                                        'is-today': isToday,
                                        'is-past': isPast,
                                    }"
                                >
                                    {{ title }}
                                </h2>
                                <span
                                    ref="calendarAnchor"
                                    class="
                                        my-day--content--editor--header--title--date-pick--icon
                                        has-tippy
                                    "
                                    :class="{
                                        'datepicker-open': datepickerOpen,
                                    }"
                                    :data-tippy-content="`<div class='tooltip'>Jump to Date</div>`"
                                >
                                    <AcreomChevronDown class="icon" size="10" />
                                </span>
                            </button>
                        </div>
                    </div>
                    <TaskReview
                        v-if="reviewEntities.length"
                        ref="taskReview"
                        :overview-date="overviewDate"
                        :document="document"
                        :wide-editor="isWideEditor"
                    />
                    <div class="my-day--content--editor__wrapper">
                        <Editor
                            ref="editor"
                            class="editor"
                            :value="editorDocument.content"
                            :doc-id="document.id"
                            :group-id="groupId"
                            :recreate-on-id-update="true"
                            @keyUp="handleEditorKeyUp"
                            @update:html="onUpdateHtmlHandler"
                            @create="handleOnCreate"
                            @scroll-to-bottom="scrollToBottom"
                            @editor:ready="handleEditorReady"
                        />
                    </div>
                    <div
                        class="my-day--content--editor--footer"
                        @click="handleFooterClick"
                    ></div>
                </div>
                <transition :name="animation">
                    <div
                        v-if="isTimelineOpen"
                        class="my-day--content--panel"
                        :class="{
                            'my-day--content--panel__detached':
                                shouldDetachTimeline,
                        }"
                    >
                        <EntityPanel
                            @focus-tab="$emit('focus-tab')"
                            @panel:close="closeTimeline"
                        />
                    </div>
                </transition>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Watch } from 'vue-property-decorator';
import { FocusPosition } from '@tiptap/core';
import {
    add,
    differenceInDays,
    format,
    isSameDay,
    startOfDay,
    sub,
} from 'date-fns';
import { animate } from 'motion';
import type Editor from '~/components/editor/EditorComponent.vue';
import TaskReview from '~/components/overview/TaskReview.vue';
import { IDocument } from '~/components/document/model';
import {
    PANEL_DETACH_WIDTH,
    PanelTypes,
    SearchServiceAction,
    ServiceKey,
    TabType,
} from '~/constants';
import MyDayHeaderControls from '~/components/tabs/scroll-headers/MyDayHeaderControls.vue';
import TabMixin from '~/components/tabs/TabMixin.vue';
import SearchBar from '~/components/editor/extensions/search/SearchBar.vue';
import AcreomChevronDown from '~/components/icons/AcreomChevronDown.vue';
import MyDayPickerDropdown from '~/components/dropdown/MyDayPickerDropdown.vue';
import EntityPanel from '~/components/entities/EntityPanel.vue';
import { TrackEvent } from '~/helpers/decorators';
import {
    TrackingAction,
    TrackingActionSource,
    TrackingType,
} from '~/@types/tracking';

type MyDayData = {
    date: Date;
    focus: boolean;
    panelOpen: boolean;
    panelType: string;
};

@Component({
    name: 'MyDayTab',
    components: {
        EntityPanel,
        AcreomChevronDown,
        MyDayHeaderControls,
        SearchBar,
        TaskReview,
        Editor: () => import('@/components/editor/EditorComponent.vue'),
    },
})
export default class MyDayTab extends TabMixin<MyDayData> {
    $refs!: {
        editor: Editor;
        taskReview: TaskReview;
        document: HTMLElement;
        myDayHeader: HTMLDivElement;
        myDayControls: HTMLDivElement;
        calendarAnchor: HTMLButtonElement;
        headerControls: MyDayHeaderControls;
    };

    hasEditor: boolean = true;
    datepickerOpen: boolean = false;
    now: Date = new Date();
    mouseDownElement: HTMLElement | null = null;
    childEditor: any = null;
    editorDocument: Partial<IDocument> = {};
    interval: any = null;
    animate: boolean = true;

    get isTimelineOpen() {
        const storedTab = this.$store.getters['tabs/byId'](this.id);
        return storedTab?.data?.panelOpen ?? true;
    }

    get animation() {
        if (!this.animate) return null;
        if (this.shouldDetachTimeline) return 'panel-detached';

        return 'panel';
    }

    get shouldDetachTimeline() {
        return this.tabWidth < PANEL_DETACH_WIDTH;
    }

    get reviewEntities() {
        return [
            ...this.$store.getters['document/agenda'](this.overviewDate),
            ...this.$store.getters['tasks/agenda'](this.overviewDate),
        ];
    }

    get isSingleTab() {
        return this.$store.getters['tabs/singleTabOpen'];
    }

    get groupWidth() {
        return this.$store.getters['tabs/groupById'](this.groupId).width;
    }

    get isWideEditor() {
        return this.$store.getters['appSettings/editorOptions'].wide;
    }

    get isToday() {
        return isSameDay(this.now, this.overviewDate);
    }

    get document() {
        const document = this.$store.getters['document/byDailyDoc'](
            this.viewDate,
        );
        if (!document) return {};
        return document;
    }

    get isPast() {
        return (
            differenceInDays(
                startOfDay(this.now),
                startOfDay(this.overviewDate),
            ) > 0
        );
    }

    get overviewDate() {
        return this.tabData?.date ?? new Date();
    }

    get viewDate() {
        return format(this.overviewDate, 'yyyy-MM-dd'); // "YYYY-MM-DD"
    }

    get editorId() {
        return this.$refs.editor?.editor?.context.editorId;
    }

    get title() {
        return format(this.overviewDate, 'EEEE, LLL d, yyyy');
    }

    get contentWidth() {
        return this.$store.getters['appSettings/editorOptions'].contentWidth;
    }

    @Watch('viewDate', { immediate: true })
    onViewDateChange(value: string) {
        const title = this.title;
        this.$store.dispatch('document/dailyDoc', { dailyDoc: value, title });
        this.$refs.editor?.clearHistory(this.document.content);
    }

    @Watch('document.content')
    handleContentChange() {
        if (this.document.editorId === this.editorId) return;
        this.editorDocument =
            this.$store.getters['document/byId'](this.document?.id) || {};
    }

    @Watch('document.updateId')
    onDocumentUpdateIdChange() {
        let shouldFocusPreviousPosition = false;
        let lastFocusPosition: any = 0;
        if (this.editorDocument.id === this.document.id) {
            shouldFocusPreviousPosition = true;
            lastFocusPosition = this.$refs.editor?.editor?.lastFocusPosition;
        }
        this.editorDocument =
            this.$store.getters['document/byId'](this.document?.id) || {};
        if (shouldFocusPreviousPosition && this.$store.getters.editorFocused) {
            this.$emit('focus-tab');
            this.$refs.editor?.focusEditor(lastFocusPosition);
        }
    }

    @Watch('document.id')
    onDocumentIdChange() {
        this.editorDocument =
            this.$store.getters['document/byId'](this.document?.id) || {};
        if (this.$refs.editor?.editor) {
            this.$refs.editor.editor.lastFocusPosition = 0;
        }

        if (this.editorDocument.content) {
            this.$refs.editor?.clearHistory(this.editorDocument.content);
        }
    }

    @Watch('document')
    onDocumentChange(doc: IDocument, oldDoc: IDocument) {
        if (!oldDoc.id) return;
        if (oldDoc.id === doc.id) return;
    }

    @Watch('tabData.focus')
    onTaskFocus(newValue: string | boolean) {
        if (newValue) {
            this.$nextTick(() => {
                this.$nuxt.$emit(`focus-task:${this.tabData?.focus}`);
                this.updateTabData({ focus: false });
            });
        }
    }

    @Watch('isActive')
    handleActive(val: boolean) {
        if (val) return;
        this.$refs.editor?.editorInstance?.commands.blur();
    }

    updateGroupData(data: any) {
        const groupDataProperties = ['panelOpen', 'date', 'panelType'];
        const groupData = groupDataProperties.reduce((acc: any, key: any) => {
            if (key in data) {
                acc[key] = data[key];
            }
            return acc;
        }, {} as any);
        if (!Object.keys(groupData).length) return;
        this.$tabs.updateGroupData(this.groupId, this.entityId, groupData);
    }

    _closeTimeline() {
        this.updateTabData({
            panelOpen: false,
        });
    }

    _openTimeline() {
        this.updateTabData({
            panelOpen: true,
            panelType: PanelTypes.MY_DAY,
        });
    }

    @TrackEvent(TrackingType.MY_DAY, {
        action: TrackingAction.OPEN_TIMELINE,
        source: TrackingActionSource.BUTTON,
    })
    openTimelineButton() {
        this._openTimeline();
    }

    @TrackEvent(TrackingType.MY_DAY, {
        action: TrackingAction.CLOSE_TIMELINE,
        source: TrackingActionSource.BUTTON,
    })
    closeTimelineButton() {
        this._closeTimeline();
    }

    @TrackEvent(TrackingType.MY_DAY, {
        action: TrackingAction.OPEN_TIMELINE,
        source: TrackingActionSource.SHORTCUT,
    })
    openTimelineShortcut() {
        this._openTimeline();
    }

    @TrackEvent(TrackingType.MY_DAY, {
        action: TrackingAction.CLOSE_TIMELINE,
        source: TrackingActionSource.SHORTCUT,
    })
    closeTimelineShortcut() {
        this._closeTimeline();
    }

    @TrackEvent(TrackingType.MY_DAY, {
        action: TrackingAction.CLOSE_TIMELINE,
        source: TrackingActionSource.TIMELINE,
    })
    closeTimeline() {
        this._closeTimeline();
    }

    toggleTimelineButton() {
        if (this.isTimelineOpen) {
            this.closeTimelineButton();
            return;
        }
        this.openTimelineButton();
    }

    toggleTimelineShortcut() {
        if (this.isTimelineOpen) {
            this.closeTimelineShortcut();
            return;
        }
        this.openTimelineShortcut();
    }

    handleEditorReady() {
        if (this.tabData?.focus) {
            this.$nuxt.$emit(`focus-task:${this.tabData?.focus}`);
            this.updateTabData({ focus: false });
        }
    }

    @TrackEvent(TrackingType.MY_DAY, {
        action: TrackingAction.CHANGE_DAY,
        source: TrackingActionSource.DATE_PICKER,
    })
    changeDay(date: Date) {
        const key = `${this.id}-calendar-date-changed`;
        this.$nuxt.$emit(key, date);
        this.updateTabData({
            date,
        });
    }

    @TrackEvent(TrackingType.MY_DAY, {
        action: TrackingAction.OPEN_DATE_PICKER,
    })
    openCalendarDropdown() {
        this.datepickerOpen = true;
        this.$dropdown.show({
            parent: this.$refs.calendarAnchor,
            component: MyDayPickerDropdown,
            animate: false,
            retainFocus: true,
            backdrop: true,
            popperOptions: {
                placement: 'bottom',
                modifiers: [
                    {
                        name: 'preventOverflow',
                        options: {
                            mainAxis: true,
                        },
                    },
                    {
                        name: 'offset',
                        options: {
                            offset: [0, 4],
                        },
                    },
                ],
            },
            bind: {
                value: this.overviewDate,
            },
            on: {
                select: (date: Date) => {
                    this.changeDay(date);
                },
            },
            onClose: () => {
                this.datepickerOpen = false;
            },
        });
    }

    handleFooterClick() {
        this.focusEditor('end');
    }

    @TrackEvent(TrackingType.AGENDA, {
        action: TrackingAction.FOCUS_AGENDA,
        source: TrackingActionSource.SHORTCUT,
    })
    focusAgenda() {
        this.$nuxt.$emit('editor:blur');
        this.$refs.taskReview.open();
    }

    handleEditorKeyUp() {
        if (!this.$refs.taskReview) return;
        this.focusAgenda();
    }

    scrollToBottom() {
        let prev = 0;
        animate(
            progress => {
                const documentDiv = this.$refs.document;
                if (!documentDiv) return;
                const step = (progress - prev) * 200;
                documentDiv.scrollTop += step;
                prev = progress;
            },
            { duration: 0.15 },
        );
    }

    onUpdateHtmlHandler(html: string) {
        this.$store.dispatch('document/update', {
            id: this.document.id,
            updatedAt: new Date(),
            content: html,
            editorId: this.editorId,
        });
        const vaultId = this.$store.getters['vault/active'].id;
        this.$serviceRegistry.emit(
            ServiceKey.SEARCH,
            SearchServiceAction.INDEX_INTERACTION,
            {
                vaultId,
                entity: this.document,
            },
        );
    }

    handleOnCreate() {
        if (
            !this.$store.getters.editorFocused &&
            !this.$store.getters.userForcedBlur &&
            this.isActive &&
            !this.getScrollPosition('editor')
        ) {
            this.focusEditor('start');
        }
        this.childEditor = this.$refs.editor?.editorInstance;
    }

    handleMouseUp(event: MouseEvent) {
        if (!this.$refs.editor) return;
        const mx = event.pageX;
        const my = event.pageY;
        const {
            top: editorY,
            left: editorX,
            right: editorXX,
        } = this.$refs.editor.$el.getBoundingClientRect();
        const editorMid = editorX + (editorXX - editorX) / 2;

        if (this.mouseDownElement?.isEqualNode(this.$refs.document)) {
            this.$emit('focus-tab');
            if (my > editorY) {
                this.$refs.editor?.focusEditorAtCoords(
                    mx < editorMid ? editorX : editorXX,
                    my,
                );
            }
        }

        this.mouseDownElement = null;
    }

    focusEditor(position: FocusPosition = 'start') {
        this.$emit('focus-tab');
        this.$nextTick(() => {
            this.$nuxt.$emit('editor:focus', position);
        });
    }

    handleMouseDown(e: Event) {
        this.mouseDownElement = e.target as HTMLElement;
    }

    @TrackEvent(TrackingType.MY_DAY, {
        action: TrackingAction.TODAY,
        source: TrackingActionSource.SHORTCUT,
    })
    setTodayShortcut() {
        this._setToday();
    }

    @TrackEvent(TrackingType.MY_DAY, {
        action: TrackingAction.TODAY,
        source: TrackingActionSource.BUTTON,
    })
    setTodayButton() {
        this._setToday();
    }

    @TrackEvent(TrackingType.MY_DAY, {
        action: TrackingAction.NEXT_DAY,
        source: TrackingActionSource.SHORTCUT,
    })
    setNextDayShortcut() {
        this._nextDay();
    }

    @TrackEvent(TrackingType.MY_DAY, {
        action: TrackingAction.NEXT_DAY,
        source: TrackingActionSource.BUTTON,
    })
    setNextDayButton() {
        this._nextDay();
    }

    @TrackEvent(TrackingType.MY_DAY, {
        action: TrackingAction.PREVIOUS_DAY,
        source: TrackingActionSource.SHORTCUT,
    })
    setPreviousDayShortcut() {
        this._previousDay();
    }

    @TrackEvent(TrackingType.MY_DAY, {
        action: TrackingAction.PREVIOUS_DAY,
        source: TrackingActionSource.BUTTON,
    })
    setPreviousDayButton() {
        this._previousDay();
    }

    _setToday() {
        const date = new Date();
        const key = `${this.id}-calendar-date-changed`;
        this.$nuxt.$emit(key, date);
        this.updateTabData({
            date,
        });
        this.$store.dispatch('integration/calendarRangeChange', {
            date,
            calendarType: 'week',
        });
    }

    _previousDay() {
        const date = sub(this.overviewDate, { days: 1 });
        const key = `${this.id}-calendar-date-changed`;
        this.$nuxt.$emit(key, date);
        this.updateTabData({
            date,
        });
        this.$store.dispatch('integration/calendarRangeChange', {
            date,
            calendarType: 'week',
        });
    }

    _nextDay() {
        const date = add(this.overviewDate, { days: 1 });
        const key = `${this.id}-calendar-date-changed`;
        this.$nuxt.$emit(key, date);
        this.updateTabData({
            date,
        });
        this.$store.dispatch('integration/calendarRangeChange', {
            date,
            calendarType: 'week',
        });
    }

    registerShortcuts() {
        this.$shortcutsManager.enableNamespace('overview');
        this.$shortcutsManager.registerShortcut(
            this.$shortcutsManager.availableShortcuts.MY_DAY_NEXT_DAY,
            () => {
                this.setNextDayShortcut();
            },
        );
        this.$shortcutsManager.registerShortcut(
            this.$shortcutsManager.availableShortcuts.MY_DAY_PREVIOUS_DAY,
            () => {
                this.setPreviousDayShortcut();
            },
        );

        this.$shortcutsManager.registerShortcut(
            this.$shortcutsManager.availableShortcuts.MY_DAY_TODAY,
            () => {
                this.setTodayShortcut();
            },
        );

        this.$shortcutsManager.registerShortcut(
            this.$shortcutsManager.availableShortcuts.PANEL_TIMELINE,
            () => {
                this.toggleTimelineShortcut();
            },
        );

        this.$shortcutsManager.registerShortcut(
            this.$shortcutsManager.availableShortcuts.REVIEW_PANEL_TOGGLE,
            () => {
                if (
                    this.$vfm.dynamicModals.length ||
                    this.$vfm.openedModals.length ||
                    this.isPast
                ) {
                    return;
                }
                this.$refs.headerControls.toggleReviewDropdown();
            },
        );
    }

    scrollToTop() {
        const docDiv = this.$refs.document;
        docDiv.scrollTop = 0;
    }

    removeShortcuts() {
        this.$shortcutsManager.disableNamespace('overview');
        this.$shortcutsManager.removeShortcut(
            this.$shortcutsManager.availableShortcuts.MY_DAY_NEXT_DAY,
        );
        this.$shortcutsManager.removeShortcut(
            this.$shortcutsManager.availableShortcuts.MY_DAY_PREVIOUS_DAY,
        );
        this.$shortcutsManager.removeShortcut(
            this.$shortcutsManager.availableShortcuts.MY_DAY_TODAY,
        );
        this.$shortcutsManager.removeShortcut(
            this.$shortcutsManager.availableShortcuts.PANEL_TIMELINE,
        );
        this.$shortcutsManager.removeShortcut(
            this.$shortcutsManager.availableShortcuts.REVIEW_PANEL_TOGGLE,
        );
    }

    registerTabHandlers() {
        this.$nuxt.$on(`tab:focus-in-${this.groupId}-${TabType.MY_DAY}`, () => {
            this.$nuxt.$nextTick(() => {
                this.$store.commit('editorFocused', false);
                this.$refs.editor.focusEditor(
                    (this.$refs.editor.editor?.lastFocusPosition ||
                        'start') as FocusPosition,
                );
            });
        });
        this.$nuxt.$on(
            `tab:focus-out-${this.groupId}-${TabType.MY_DAY}`,
            () => {
                this.$refs.editor.blurEditor();
            },
        );
        this.$nuxt.$on(
            `sidebar:focus-document-${this.groupId}-${TabType.MY_DAY}`,
            () => {
                this.$nuxt.$nextTick(() => {
                    this.$refs.editor.focusEditor(
                        (this.$refs.editor.editor?.lastFocusPosition ||
                            'start') as FocusPosition,
                    );
                });
            },
        );
    }

    registerScrollObservable() {
        const setScroll = () => {
            this.$refs.document.scrollTop = this.getScrollPosition();
            this.$refs.document.addEventListener('scroll', (e: any) => {
                this.setScrollPositions(e.target.scrollTop);
            });
        };

        const editorObserver = new MutationObserver(
            (mutationList, observer) => {
                const editorLoadedMutation = mutationList.find(mutation => {
                    return (
                        mutation.type === 'childList' &&
                        mutation.addedNodes.length &&
                        (
                            mutation.addedNodes[0] as HTMLElement
                        )?.classList?.contains('ProseMirror')
                    );
                });
                if (!editorLoadedMutation) return;
                setScroll();
                observer.disconnect();
            },
        );

        editorObserver.observe(this.$refs.document, {
            subtree: true,
            childList: true,
        });
    }

    enableShortcutNamespaces() {
        this.$shortcutsManager.enableNamespace('overview');
    }

    disableShortcutNamespaces() {
        this.$shortcutsManager.disableNamespace('overview');
    }

    beforeDestroy() {
        this.removeShortcuts();
        this.$nuxt.$off(`tab:focus-in-${this.groupId}-${TabType.MY_DAY}`);
        this.$nuxt.$off(`tab:focus-out-${this.groupId}-${TabType.MY_DAY}`);
        this.$nuxt.$off(
            `sidebar:focus-document-${this.groupId}-${TabType.MY_DAY}`,
        );
        this.$nuxt.$off('new-day');
    }

    mounted() {
        if (this.interval) return;
        this.registerScrollObservable();

        this.editorDocument =
            this.$store.getters['document/byId'](this.document.id) || {};

        this.$nuxt.$on('new-day', () => {
            this.now = new Date();
        });
        this.registerTabHandlers();

        this.$store.dispatch('integration/calendarRangeChange', {
            date: this.overviewDate || startOfDay(new Date()),
            calendarType: 'day',
        });

        this.interval = setInterval(() => {
            this.now = new Date();
        }, 5 * 60 * 1000); // every 5 minutes
    }
}
</script>

<style scoped lang="scss">
.my-day {
    &--search {
        position: absolute;
        right: 4px;
        top: 36px;
        z-index: 100;

        &.single-tab {
            top: 0;
        }

        &.panel-open {
            right: 407px;
        }
    }

    &--content {
        position: relative;
        width: 100%;
        height: $desktopContentHeight;

        &--wrapper {
            @include scrollbar(3px, 9px);
            overflow-y: auto;
            overflow-x: hidden;
            height: $desktopContentHeight;
            width: 100%;
            transition: width 0.3s cubic-bezier(0, 0.45, 0.2, 1);

            &__panel-open {
                width: calc(100% - 403px);
            }

            .tab-group__active & {
                @include scrollbar(36px, 9px);
            }
        }

        &--editor {
            margin: 0 auto 0;
            display: flex;
            flex-direction: column;
            height: 100%;
            padding: 0 15px 0px;

            &__wrapper {
                padding: 0 15px;
            }

            &.wide-editor {
                max-width: 100%;
            }

            &--header {
                user-select: none;

                &--controls {
                    margin-bottom: 15px;
                }

                h2 {
                    position: relative;
                    font-weight: bold;
                    font-size: 26px;
                    line-height: 40px;
                    color: var(--tab-title-text-color);
                    text-align: left;

                    &.is-past {
                        color: var(--my-day-tab-title-color__past);
                    }
                }

                &--title {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                    margin-bottom: 11px;
                    padding: 0 15px;

                    &--date-pick {
                        display: flex;
                        align-items: center;
                        justify-content: flex-start;
                        gap: 8px;

                        &--icon {
                            padding: 6px;
                            border-radius: 50%;
                            color: var(--tab-controls-icon-color);
                            background: var(--tab-controls-bg-color);
                            flex-shrink: 0;

                            &:hover,
                            &.datepicker-open {
                                color: var(--tab-controls-icon-color__hover);
                                background: var(--tab-controls-bg-color__hover);
                            }
                        }
                    }
                }
            }

            &--footer {
                cursor: text;
                min-height: 200px;
                height: 100%;
            }
        }

        &--panel {
            transition: transform 0.3s cubic-bezier(0, 0.45, 0.2, 1);
            position: absolute;
            max-width: 403px;
            width: 100%;
            height: 100%;
            top: 0;
            right: 0;

            &__detached {
                max-width: 100%;
                height: 100%;
            }
        }
    }
}
</style>
