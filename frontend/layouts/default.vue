<template>
    <div
        id="app"
        ref="app"
        :class="[!sidebarOpen ? 'hide-sidebar' : null]"
        :style="cssProps"
    >
        <div
            id="app-panel"
            ref="appBody"
            :class="{
                'dragging-sidebar': resizingSidebar,
            }"
            class="app-body"
        >
            <div
                class="tabs-header"
                :class="[!sidebarOpen ? 'hide-sidebar' : null]"
            >
                <AppHeader />
            </div>
            <div
                class="app-sidebar"
                :class="{
                    closed: !sidebarOpen,
                    dragging: resizingSidebar,
                }"
            >
                <Sidebar id="sidebar" ref="sidebar" />
            </div>
            <div
                class="app-content"
                :class="{ 'dragging-sidebar': resizingSidebar }"
            >
                <Nuxt />
            </div>
        </div>
        <Cheatsheet :show="showCheatsheet" />
        <ModalsContainer></ModalsContainer>
        <NotificationContainer />
        <ContextMenuContainer />
        <DropdownContainer />
        <DraggingInfo
            v-show="draggingFolder"
            :dragged-item="draggedSidebarItem"
            :offset-left="offsetLeft"
            :offset-top="offsetTop"
        />
        <PageListDraggingInfo
            v-if="draggingInView"
            :offset-left="offsetLeft"
            :offset-top="offsetTop"
        />
        <div id="popper-container"></div>
    </div>
</template>
<script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator';
import { format, getHours, isAfter, startOfDay } from 'date-fns';
import { v4 } from 'uuid';
import Sidebar from '@/components/sidebar/Sidebar.vue';
import { isElectron } from '~/helpers/is-electron';
import TrafficLights from '~/components/mac/TrafficLights.vue';
import { createQcTaskObject } from '~/helpers/tasks';
import {
    APP_COLORS,
    Color,
    DatabaseServiceAction,
    ServiceKey,
    TabType,
} from '~/constants';
import { IVault, SafeElectronWindow } from '~/@types';
import DraggingInfo from '~/components/sidebar/DraggingInfo.vue';
import { throttle } from '@/helpers';
import AppHeader from '~/components/header/app-header/AppHeader.vue';
import SidebarControls from '~/components/header/app-header/SidebarControls.vue';
import TabGroupHeader from '~/components/tabs/TabGroupHeader.vue';
import { SHORTCUTS_ALIASES } from '~/plugins/shortcuts-manager/keybinds';
import '~/components/entities';
import '~/components/entities/linear';
import { ITask } from '~/components/task/model';
import { getDateInDailyDocFormat, ThemeOptions } from '~/helpers/date';
import PageListDraggingInfo from '~/components/page-list/PageListDraggingInfo.vue';
import {
    TrackingAction,
    TrackingActionSource,
    TrackingActionSourceMeta,
    TrackingType,
} from '~/@types/tracking';

const throttledByFps = throttle(requestAnimationFrame);
let appResizeObserver: any = null;

@Component({
    middleware: 'hasVaults',
    components: {
        TabGroupHeader,
        SidebarControls,
        AppHeader,
        TrafficLights,
        Sidebar,
        Cheatsheet: () => import('~/components/cheatsheet/index.vue'),
        DraggingInfo,
        PageListDraggingInfo,
    },
    head() {
        return {
            htmlAttrs: {
                style: `--accent-color: ${
                    (this as any).accentColor
                }; --accent-color-triplet: ${(this as any).accentColorTriplet}`,
                class: [
                    'acreom-app',
                    this.$config.platform,
                    `theme-${this.$store.getters[
                        'appSettings/theme'
                    ].toLowerCase()}`,
                ],
            },
            bodyAttrs: {
                class: [
                    'theme-dark',
                    ...new Set(['app', this.$config.platform, this.$config.os]),
                ].join(' '),
            },
        };
    },
})
export default class DefaultLayout extends Vue {
    $refs!: {
        app: HTMLElement;
        sidebar: Sidebar;
        panel: HTMLElement;
        appBody: HTMLElement;
        dragInfo: HTMLElement;
    };

    metaKey: boolean = false;
    timer: any = null;
    globalInterval: any = null;
    previousTime: Date = new Date();
    shouldRollOver: boolean = false;
    previousWidth: number | null = null;
    draggingFolder: boolean = false;
    viewportHeightInPixels: number | null = null;
    localConflictsModalVisible = false;
    resizingSidebar: boolean = false;
    resizingSidebarWidth = 250;
    offsetLeft: number = 0;
    offsetTop: number = 0;
    draggingTimeout: any = null;

    get accentColor() {
        const appColor = this.$store.getters['appSettings/appColor'];
        return appColor.COLOR;
    }

    get accentColorTriplet() {
        const appColor = this.$store.getters['appSettings/appColor'];
        return appColor.TRIPLET;
    }

    get localConflicts() {
        return this.$store.getters['localConflicts/localConflicts'];
    }

    get sidebarWidth() {
        if (this.resizingSidebar) return this.resizingSidebarWidth;
        return this.$store.getters['misc/sidebarWidth'];
    }

    @Watch('localConflicts')
    async handleLocalConflicts() {
        if (this.localConflictsModalVisible || !this.localConflicts.length)
            return;
        this.localConflictsModalVisible = true;
        await this.$vfm.show({
            component: () =>
                import('~/components/modal/LocalConflictsModal.vue') as any,
            bind: {
                conflicts: this.localConflicts,
                vault: this.$store.getters['vault/active'],
            },
            on: {
                acceptRemote: () => {
                    this.localConflictsModalVisible = false;
                    this.$serviceRegistry.emit(
                        ServiceKey.DATABASE,
                        DatabaseServiceAction.ACCEPT_REMOTE_CHANGES,
                        {
                            payload: {
                                changes: this.localConflicts,
                                vaultId:
                                    this.$store.getters['vault/active']?.id,
                            },
                        },
                    );
                },
                acceptLocal: () => {
                    this.localConflictsModalVisible = false;
                    this.$serviceRegistry.emit(
                        ServiceKey.DATABASE,
                        DatabaseServiceAction.ACCEPT_LOCAL_CHANGES,
                        {
                            payload: {
                                changes: this.localConflicts,
                                vaultId:
                                    this.$store.getters['vault/active']?.id,
                            },
                        },
                    );
                },
            },
        });
    }

    get cssProps() {
        return {
            '--viewport-height': `100vh`,
            '--sidebar-width': `${this.sidebarWidth}px`,
            '--bottom-bar-height': `0px`,
            '--bubble-menu-height': ` 0px`,
        };
    }

    get sidebarOpen() {
        return this.$store.getters['misc/sidebarOpen'];
    }

    get draggedSidebarItem() {
        return (
            this.$store.getters['sidebar/draggedItem'] ||
            this.$store.getters['sidebar/draggedPinItem'] ||
            this.$store.getters['sidebar/draggedMenuItem']
        );
    }

    handleGlobalInterval() {
        if (getHours(this.previousTime) === 2 && getHours(new Date()) === 3) {
            this.shouldRollOver = true;
        }

        if (this.shouldRollOver) {
            const activeTabs = this.$utils.navigation.activeTabs;
            activeTabs.forEach(tab => {
                if (tab.type === TabType.MY_DAY) {
                    this.$tabs.updateTabData(tab.id, {
                        date: new Date(),
                    });
                }
            });

            this.$store.commit('dailyDoc/set', new Date());
            this.shouldRollOver = false;
        }

        this.previousTime = new Date();
    }

    get showCheatsheet() {
        return this.$store.getters.cheatsheetOpen;
    }

    keyDownListener = (_e: KeyboardEvent) => {
        if (this.metaKey) {
            this.metaKey = false;
            this.$store.commit('closeCheatsheet');
        }
    };

    keyUpListener = () => {
        if (this.metaKey) {
            this.metaKey = false;
            this.$store.commit('closeCheatsheet');
            if (this.timer) {
                clearTimeout(this.timer);
            }
        }
    };

    resizeListener() {
        throttledByFps(() => {
            if (!this.previousWidth) return;
            const currentWidth = window.innerWidth;
            if (this.previousWidth === currentWidth) return;
            const sidebarWidth = this.$store.getters['misc/sidebarWidth'];
            if (currentWidth < 790 && this.previousWidth > 790) {
                this.$dropdown.hideAll();
            }
            this.$store.dispatch(
                'misc/setViewportWidth',
                currentWidth - sidebarWidth,
            );
            this.$tabs.recalculateAllTabs();

            this.previousWidth = currentWidth;
        });
    }

    registerTrayActions() {
        (window as SafeElectronWindow).electron.on('new-document', () => {
            const tab = this.$tabs.createNewTabObject(v4(), TabType.DOCUMENT);
            this.$tabs.openTab(tab);
        });

        (window as SafeElectronWindow).electron.on(
            'open-event',
            async ({ id, vaultId }: { id: string; vaultId: string }) => {
                const activeVault = this.$store.getters['vault/active'];
                if (activeVault.id !== vaultId) {
                    await this.$store.dispatch('vault/activate', vaultId);
                }

                await this.$vfm.hideAll();

                const event = this.$store.getters['event/byId'](id);

                if (!event) return;

                this.$vfm.show({
                    component: () =>
                        import(
                            '~/components/event/modal/EventModal.vue'
                        ) as any,
                    bind: {
                        event: {
                            ...event,
                        },
                    },
                });
            },
        );

        (window as SafeElectronWindow).electron.on(
            'open-preferences',
            (tab?: string) => {
                this.$utils.navigation.openSettings(
                    tab,
                    TrackingActionSource.TRAY,
                );
            },
        );

        (window as SafeElectronWindow).electron.on('new-day', () => {
            this.$store.commit('dailyDoc/today');
            this.$store.dispatch(
                'dailyDoc/calendarSetDate',
                new Date(this.$store.getters['dailyDoc/date']),
            );
            this.$nuxt.$emit('new-day');
        });
    }

    registerShortcuts() {
        const availableShortcuts = this.$shortcutsManager.availableShortcuts;
        this.$shortcutsManager.registerShortcut(
            availableShortcuts.OPEN_SETTINGS,
            () => {
                const modal = this.$vfm.openedModals.find(
                    (modal: any) => modal.name === 'settings-modal',
                );

                if (modal) {
                    this.$vfm.hide('settings-modal');
                    return;
                }

                this.$utils.navigation.openSettings(
                    'overview',
                    TrackingActionSource.SHORTCUT,
                );
            },
        );

        this.$shortcutsManager.registerShortcut(
            availableShortcuts.OPEN_SEARCH,
            () => {
                window.$nuxt.$emit('open-search', {
                    includeInteractions: true,
                    source: TrackingActionSource.SHORTCUT,
                });
            },
        );

        this.$shortcutsManager.registerShortcut(
            availableShortcuts.OPEN_FULL_SEARCH,
            () => {
                window.$nuxt.$emit('open-full-search');
                this.$tracking.trackEventV2(TrackingType.FULL_SEARCH, {
                    source: TrackingActionSource.SHORTCUT,
                    action: TrackingAction.OPEN_FULL_SEARCH,
                    sourceMeta: TrackingActionSourceMeta.SEARCH,
                });
            },
        );

        this.$shortcutsManager.registerShortcut(
            availableShortcuts.OPEN_XRAY,
            () => {
                if (!this.$utils.assistant.assistantEnabled) return;
                window.$nuxt.$emit('open-full-search', '', 'assistant');
                this.$tracking.trackEventV2(TrackingType.FULL_SEARCH, {
                    source: TrackingActionSource.SHORTCUT,
                    action: TrackingAction.OPEN_FULL_SEARCH,
                    sourceMeta: TrackingActionSourceMeta.ASSISTANT,
                });
            },
        );

        this.$shortcutsManager.registerShortcut(
            availableShortcuts.OPEN_DOCUMENT_SEARCH,
            () => {
                const activeTab = this.$tabs.activeTab();
                if (!activeTab) return;

                if (
                    ![TabType.DOCUMENT, TabType.MY_DAY].includes(activeTab.type)
                ) {
                    return;
                }
                const tabId = activeTab.id;
                this.$store.dispatch('tabs/updateTabData', {
                    tabId,
                    data: {
                        searchOpen: true,
                        searchFocus: true,
                        searchTerm: '',
                    },
                });
            },
        );

        this.$shortcutsManager.registerShortcut(
            availableShortcuts.PANEL_INFO,
            () => {
                const activeTab = this.$tabs.activeTab();
                if (!activeTab) return;

                if (activeTab.type !== TabType.DOCUMENT) return;
                this.$nuxt.$emit(
                    `toggle-panel-${activeTab.id}`,
                    'page',
                    null,
                    TrackingActionSource.SHORTCUT,
                );
            },
        );
        this.registerShareShortcut();
    }

    viewPortChangeListener(event: any) {
        throttledByFps(() => {
            const { target } = event;
            this.viewportHeightInPixels = Math.round(target.height);
        });
    }

    registerQuickCaptureActions() {
        (window as SafeElectronWindow).electron.on(
            'quick-capture',
            async (text: string) => {
                const today = new Date();
                const todayDate = getDateInDailyDocFormat(today);
                const todayTitle = format(today, 'EEEE, LLL d, yyyy');
                await this.$store.dispatch('document/dailyDoc', {
                    dailyDoc: todayDate,
                    title: todayTitle,
                });
                const todayDoc =
                    this.$store.getters['document/byDailyDoc'](todayDate);
                const newContent =
                    todayDoc.content === '<p></p>'
                        ? text
                        : todayDoc.content + text;
                await this.$store.dispatch('document/update', {
                    ...todayDoc,
                    content: newContent,
                    updateId: v4(),
                });

                this.$tracking.trackEvent('quick-capture', {
                    action: 'submit',
                });
            },
        );

        (window as SafeElectronWindow).electron.on(
            'quick-capture-page',
            (page: any) => {
                const projectId = null;
                const sharingUuid = null;
                const id = v4();

                const payload = {
                    id,
                    title: page.title ?? '',
                    content: page.content,
                    projectId,
                    sharingUuid,
                    status: 'new',
                    updatedAt: new Date(),
                    createdAt: new Date(),
                };
                this.$store.dispatch('document/new', payload);
                this.$store.dispatch('document/update', payload);
                this.$tracking.trackEvent('quick-capture-add-page');
            },
        );
    }

    @Watch('$utils.navigation.activeTabId', { immediate: true })
    handleActiveTab() {
        this.$nuxt.$emit('activeTab', this.$utils.navigation.activeTabId);
    }

    registerGlobalHandlers() {
        (window as SafeElectronWindow)?.electron?.setQCShortcut?.(
            '',
            this.$shortcutsManager.keybinds[SHORTCUTS_ALIASES.QUICK_CAPTURE]
                .keybind,
        );
    }

    registerDropFileHandlers() {
        const isValidDragEvent = (event: DragEvent) => {
            if (!this.$utils.isElectron()) return false;
            if (this.$router.currentRoute.name !== 'index') return false;
            const activeVaultId = this.$store.getters['vault/activeVaultId'];
            if (!activeVaultId) return false;

            // Check if event.dataTransfer.items is available
            if (event.dataTransfer?.items) {
                // Use DataTransferItemList interface to check for files
                for (let i = 0; i < event.dataTransfer.items.length; i++) {
                    // If any of the dropped items is a file, return true
                    if (event.dataTransfer.items[i].kind === 'file') {
                        return true;
                    }
                }
            } else if (
                event.dataTransfer?.files &&
                event.dataTransfer.files.length > 0
            ) {
                // Fallback to checking the DataTransfer.files list directly
                // If there's at least one file, return true
                return true;
            }

            // If no files were found, return false
            return false;
        };

        document.addEventListener('dragover', e => {
            e.preventDefault();
            e.stopPropagation();
        });

        document.addEventListener('drop', event => {
            event.preventDefault();
            event.stopPropagation();

            if (!isValidDragEvent(event)) return;

            const filepaths = [];
            for (const file of (event.dataTransfer?.files ?? []) as any) {
                filepaths.push(file.path);
            }
            if (!filepaths.length) return;
            this.$serviceRegistry.emit(
                ServiceKey.DATABASE,
                DatabaseServiceAction.IMPORT_MARKDOWN,
                {
                    payload: {
                        vaultId: this.$store.getters['vault/activeVaultId'],
                        filepaths,
                    },
                },
            );

            this.$tracking.trackEventV2(TrackingType.IMPORT, {
                action: TrackingAction.COMPLETE,
                source: TrackingActionSource.DRAG_AND_DROP,
            });
        });
    }

    get draggingInView() {
        const drag = this.$utils.pageList.getDragData();
        return !!drag;
    }

    async mounted() {
        this.$tracking.activityPing('default.vue');
        this.registerDropFileHandlers();
        localStorage.setItem('skeleton-loader', 'true');
        this.$shortcutsManager.initialize();
        this.$tabs.initializeHistory();

        this.$nuxt.$on('force-filepath', (vault: IVault) => {
            this.$vfm.show({
                component: () =>
                    import('~/components/modal/ForceFilepathModal.vue') as any,
                bind: {
                    vault,
                },
            });
        });

        if (this.$refs.sidebar?.$el) {
            const { default: interact } = await import('interactjs');
            interact(this.$refs.sidebar.$el as any)
                .resizable({
                    edges: {
                        top: false,
                        left: false,
                        bottom: false,
                        right: this.$refs.sidebar.$refs.resizeHandle as any,
                    },
                    modifiers: [
                        interact.modifiers.restrictSize({
                            min: { width: 185 } as any,
                            max: { width: 530 } as any,
                        }),
                    ],
                    listeners: {
                        move: (event: any) => {
                            throttledByFps(() => {
                                this.resizingSidebarWidth = Math.round(
                                    event.rect.width,
                                );
                            });
                        },
                    },
                })
                .on('resizestart', () => {
                    this.resizingSidebarWidth =
                        this.$store.getters['misc/sidebarWidth'];
                    this.resizingSidebar = true;
                })
                .on('resizeend', () => {
                    this.$tracking.trackEventV2(TrackingType.SIDEBAR, {
                        action: TrackingAction.RESIZE,
                    });
                    this.resizingSidebar = false;
                    this.$store.commit(
                        'misc/setSidebarWidth',
                        this.resizingSidebarWidth,
                    );
                });
        }

        window.visualViewport?.addEventListener(
            'resize',
            this.viewPortChangeListener,
        );

        if (this.$route.name === 'index') {
            this.$shortcutsManager.enableNamespace('overview');
        }

        this.$shortcutsManager.enableNamespace('global');
        this.registerShortcuts();

        if (isElectron()) {
            this.registerTrayActions();
            this.registerGlobalHandlers();
            this.registerQuickCaptureActions();
        }

        this.previousWidth = window.innerWidth;
        await this.$store.dispatch(
            'misc/setViewportWidth',
            this.previousWidth - this.$store.getters['misc/sidebarWidth'],
        );
        this.resizeListener();

        await this.$tabs.recalculateAllTabs();

        if (document) {
            document.addEventListener(
                'keydown',
                this.keyDownListener.bind(this),
            );
            document.addEventListener('keyup', this.keyUpListener.bind(this));
        }

        document.addEventListener('blur', () => {
            this.$store.commit('closeCheatsheet');
        });

        appResizeObserver = new ResizeObserver(this.resizeListener);
        if (this.$refs.app) {
            appResizeObserver.observe(this.$refs.app);
        }

        this.globalInterval = setInterval(
            this.handleGlobalInterval,
            5 * 60 * 1000,
        );
        this.handleMyDayRollover();

        this.$nuxt.$on('sidebar:dragstart', ({ pageX, pageY }: any) => {
            const onMouseMoveHandler = (event: MouseEvent) => {
                this.draggingFolder = true;
                throttledByFps(() => {
                    this.offsetLeft = event.pageX;
                    this.offsetTop = event.pageY;
                });
            };

            this.draggingFolder = true;

            this.offsetLeft = pageX;
            this.offsetTop = pageY;

            const onMouseUpHandler = (_: MouseEvent) => {
                this.draggingFolder = false;
                clearTimeout(this.draggingTimeout);
                this.$nextTick(() => {
                    this.$store.commit('sidebar/clearDraggedItems');
                });
                document.removeEventListener('mousemove', onMouseMoveHandler);
                document.removeEventListener('mouseup', onMouseUpHandler);
            };

            document.addEventListener('mousemove', onMouseMoveHandler);
            document.addEventListener('mouseup', onMouseUpHandler);
        });

        if (this.showTrialMessage) {
            this.$vfm.show({
                component: () =>
                    import('~/components/modal/TrialStartedModal.vue'),
            });
        }
    }

    handleMyDayRollover() {
        if (!this.$utils.isElectron()) return;
        (window as SafeElectronWindow).electron.on('focus', () => {
            this.rolloverMyDay();
        });
        (window as SafeElectronWindow).electron.on('blur', () => {
            this.previousTime = new Date();
        });
    }

    rolloverMyDay() {
        const startOfToday = startOfDay(new Date());
        const interactedToday = isAfter(this.previousTime, startOfToday);
        if (interactedToday) return;

        const activeTabs = this.$utils.navigation.activeTabs;
        activeTabs.forEach(tab => {
            if (tab.type === TabType.MY_DAY) {
                this.$tabs.updateTabData(tab.id, {
                    date: new Date(),
                });
            }
        });
    }

    get showTrialMessage() {
        return this.$store.getters['subscription/trialOptions']
            .showTrialMessage;
    }

    registerShareShortcut() {
        this.$shortcutsManager.registerShortcut(SHORTCUTS_ALIASES.SHARE, () => {
            if (this.$store.getters['vault/isActiveLocal']) return;
            const tab = this.$utils.navigation.activeTab;
            if (tab.type !== TabType.DOCUMENT) return;
            this.openShareModal(tab.entityId);
        });
    }

    openShareModal(documentId: string) {
        const document = this.$store.getters['document/byId'](documentId);
        this.$vfm.show({
            component: () => import('@/components/modal/ShareModal.vue') as any,
            bind: {
                document,
            },
        });
    }

    beforeDestroy() {
        if (appResizeObserver) {
            appResizeObserver.disconnect();
        }

        document.removeEventListener('keydown', this.keyDownListener);
        document.removeEventListener('keyup', this.keyUpListener);
        window.visualViewport?.removeEventListener(
            'resize',
            this.viewPortChangeListener,
        );
        clearInterval(this.globalInterval);
        this.$shortcutsManager.removeShortcut(SHORTCUTS_ALIASES.SHARE);
        this.$shortcutsManager.clear();
    }
}
</script>
<style lang="scss" scoped>
.import-backdrop {
    z-index: 1000000;
    background: var(--cheat-sheet-backdrop-color);
    opacity: 0.4;
    position: absolute;
    top: 0;
    left: 0;
    width: 100vw;
    height: var(--viewport-height);
}

#app {
    position: relative;
    width: 100vw;
    height: var(--viewport-height);

    .app-content {
        z-index: 1;
        position: relative;
        margin-left: calc(var(--sidebar-width) - 8px);

        &:not(.dragging-sidebar) {
            transition: margin-left 200ms;
            will-change: margin-left;
        }

        .dragging-sidebar {
            transition: none;
        }

        > div:not(.sidebar-toggle--wrapper) {
            position: relative;
        }

        .sidebar-toggle {
            &--wrapper {
                position: absolute;
                left: 5px;
                top: 65px;
                height: calc(var(--viewport-height) - 53px);
                display: flex;
                align-items: center;

                &:hover button {
                    opacity: 1;
                }
            }
        }
    }

    &.hide-sidebar {
        .app-content {
            margin-left: 0px;
        }
    }

    .app-sidebar {
        padding-top: 6px;
        height: calc(var(--viewport-height));
        position: absolute;
        width: var(--sidebar-width);
        transition: transform 200ms;
        will-change: transform;
        z-index: 2;

        &.closed {
            transform: translateX(-100%);
        }
    }

    .tabs-header {
        display: flex;

        .group {
            margin-left: 10px;
            width: 100%;
        }
    }
}
</style>
