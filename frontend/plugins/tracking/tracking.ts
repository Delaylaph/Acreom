import Cookies from 'js-cookie';
import { v4 } from 'uuid';
import Bowser from 'bowser';
import axios from 'axios';
import { Context } from '@nuxt/types';
import { xor } from 'lodash';
import { IFolder, SafeElectronWindow } from '~/@types';
import {
    TrackingAction,
    TrackingActionSource,
    TrackingActionSourceMeta,
    TrackingProperties,
    TrackingType,
} from '~/@types/tracking';
import { Tab } from '~/@types/app';
import {
    FolderType,
    GroupingOptions,
    IntegrationType,
    PageStatus,
    SortingOptions,
    TabType,
    ViewType,
} from '~/constants';
import { IView } from '~/components/view/model';

const LOCAL_STORAGE_PREFIX = '_app_t';
const SESSION_TIMEOUT = 1000 * 60 * 10;

type TrackerContext = {
    platform: 'web' | 'desktop' | 'mobile';
    os: 'web' | 'windows' | 'mac' | 'linux' | 'ios' | 'android';
    defaultProperties?: Record<string, any>;
    store: Context['store'];
};

const cookieStorageWrapper = {
    getQueryKey(key: string): string {
        return `${LOCAL_STORAGE_PREFIX}_${key}`;
    },
    get(key: string): any {
        const storageKey = this.getQueryKey(key);
        let value;
        const data = Cookies.get(storageKey);

        if (!data) return null;

        try {
            value = JSON.parse(data);
        } catch (e) {
            return null;
        }

        if (typeof value === 'object' && typeof value.data !== 'undefined') {
            return value.data;
        }

        return null;
    },
    set(key: string, value: any): void {
        const storageKey = this.getQueryKey(key);

        try {
            Cookies.set(storageKey, JSON.stringify({ data: value }), {
                expires: 365 * 3,
                secure: true,
                domain: '.acreom.com',
            });
        } catch (e) {
            console.warn('localStorage is full');
        }
    },
};

const localStorageWrapper = {
    getQueryKey(key: string): string {
        return `${LOCAL_STORAGE_PREFIX}_${key}`;
    },
    get(key: string): any {
        const storageKey = this.getQueryKey(key);
        let value;
        const data = localStorage.getItem(storageKey);

        if (!data) return null;

        try {
            value = JSON.parse(data);
        } catch (e) {
            if (localStorage[storageKey]) {
                value = { data: localStorage.getItem(storageKey) };
            } else {
                return null;
            }
        }

        if (typeof value === 'object' && typeof value.data !== 'undefined') {
            return value.data;
        }

        return null;
    },
    set(key: string, value: any): void {
        const storageKey = this.getQueryKey(key);

        try {
            localStorage.setItem(storageKey, JSON.stringify({ data: value }));
        } catch (e) {
            console.warn('localStorage is full');
        }
    },
};

export class TrackingStorage {
    private adapter:
        | typeof localStorageWrapper
        | typeof cookieStorageWrapper
        | SafeElectronWindow['electron']['store'];

    constructor(
        platform: TrackerContext['platform'],
        os: TrackerContext['os'],
    ) {
        if (platform === 'desktop') {
            // fix localhost for browser login & redirect
            this.adapter =
                (window as SafeElectronWindow)?.electron?.store ??
                localStorageWrapper;
        } else if (platform === 'web') {
            this.adapter = cookieStorageWrapper; // cookie adapter
        } else if (platform === 'mobile' && os === 'ios') {
            this.adapter = localStorageWrapper; // ios adapter
        } else if (platform === 'mobile' && os === 'android') {
            this.adapter = localStorageWrapper; // android adapter
        } else {
            this.adapter = localStorageWrapper;
        }
    }

    get(key: string): any {
        const value = this.adapter.get(key);
        return value;
    }

    set(key: string, value: any): void {
        this.adapter.set(key, value);
    }
}

export class Tracker {
    platform: 'web' | 'desktop' | 'mobile';
    os: 'web' | 'windows' | 'mac' | 'linux' | 'ios' | 'android';
    defaultProperties: Record<string, any>;
    storage: TrackingStorage;
    trackingUrl: string;
    trackingUrlV2: string;
    store: Context['store'];
    lastPingTimestamp: number = 0;
    sessionStart: number | null;
    sessionId: string;

    constructor(
        ctx: TrackerContext,
        trackingUrl: string,
        trackingUrlV2: string,
    ) {
        this.platform = ctx.platform;
        this.os = ctx.os;
        this.store = ctx.store;
        this.defaultProperties = ctx.defaultProperties || {};
        this.storage = this.resolveStorage();
        this.lastPingTimestamp =
            this.storage.get('last_ping_timestamp') || Date.now();
        this.sessionStart = this.storage.get('session_start') || null;
        this.trackingUrl = trackingUrl;
        this.trackingUrlV2 = trackingUrlV2;
        this.sessionId = this.storage.get('session_id') || v4();
        this.initialize();
    }

    resolveStorage() {
        return new TrackingStorage(this.platform, this.os);
    }

    trackDropdownEvent(type: TrackingType, newData: any, oldData: any) {
        let action: any = null;
        Object.keys(newData).forEach((key: string) => {
            let sourceMeta: TrackingActionSourceMeta | null | undefined;
            const value = newData[key];

            switch (key) {
                case 'sortBy':
                    action = this.resolveSortBy(value);
                    sourceMeta = this.resolveSortDirection(
                        oldData.sortDirection,
                    );
                    break;
                case 'sortDirection':
                    action = this.resolveSortDirection(value);
                    sourceMeta = this.resolveSortBy(oldData.sortBy);
                    break;
                case 'groupBy':
                    action = this.resolveGroupBy(value);
                    break;
                case 'showTasks':
                    action =
                        value === true
                            ? TrackingAction.SHOW_TASKS
                            : TrackingAction.HIDE_TASKS;
                    break;
                case 'hideCompletedTasks':
                    action =
                        value === true
                            ? TrackingAction.HIDE_COMPLETED_TASKS
                            : TrackingAction.SHOW_COMPLETED_TASKS;
                    break;
                case 'selectedDisplayProperties':
                    action =
                        value.length > oldData.selectedDisplayProperties.length
                            ? TrackingAction.SHOW_DISPLAY_PROPERTY
                            : TrackingAction.HIDE_DISPLAY_PROPERTY;
                    sourceMeta = this.resolveUpdatedDisplayProperty(
                        oldData.selectedDisplayProperties,
                        value,
                    );
                    break;
            }

            if (action) {
                this.trackEventV2(type, {
                    action,
                    sourceMeta,
                });
            }
        });
    }

    resolveSourceMetaFromTab(
        tabOrId: Tab | string,
    ): TrackingActionSourceMeta | undefined {
        let tab: Tab | null;
        if (typeof tabOrId === 'string') {
            tab = this.store.getters['tabs/byId'](tabOrId) as Tab | null;
        } else {
            tab = tabOrId;
        }
        if (!tab || !tab.data?.viewOptions?.groupBy)
            return TrackingActionSourceMeta.GROUP_BY_NONE;

        const groupBy = tab.data.viewOptions.groupBy;

        switch (groupBy) {
            case GroupingOptions.NONE:
                return TrackingActionSourceMeta.GROUP_BY_NONE;
            case GroupingOptions.PAGE_STATUS:
                return TrackingActionSourceMeta.GROUP_BY_STATUS;
            case GroupingOptions.FOLDER:
                return TrackingActionSourceMeta.GROUP_BY_FOLDER;
        }
    }

    resolveTypeFromView(viewId: string): TrackingType | null {
        const view = this.store.getters['view/byId'](viewId);
        if (!view) return null;

        switch (view.type) {
            case ViewType.ARCHIVE:
                return TrackingType.ARCHIVE;
            case ViewType.ACTIVE:
                return TrackingType.ACTIVE;
            case ViewType.ALL_PAGES:
                return TrackingType.ALL_PAGES;
            case ViewType.CUSTOM:
                return TrackingType.CUSTOM_VIEW;
        }

        return null;
    }

    resolveActionFromPageStatus(status: PageStatus | null): TrackingAction {
        switch (status) {
            case PageStatus.TODO:
                return TrackingAction.TODO;
            case PageStatus.IN_PROGRESS:
                return TrackingAction.IN_PROGRESS;
            case PageStatus.DONE:
                return TrackingAction.DONE;
        }

        return TrackingAction.NO_STATUS;
    }

    resolveSourceFromViewOrProject(
        viewOrProjectOrId: IView | IFolder | string,
    ): TrackingActionSource | null {
        let view;
        if (typeof viewOrProjectOrId === 'string') {
            view = (this.store.getters['view/byId'](viewOrProjectOrId) ||
                this.store.getters['folder/byId'](
                    viewOrProjectOrId,
                )) as Tab | null;
        } else {
            view = viewOrProjectOrId;
        }

        if (!view) return null;
        switch (view.type) {
            case ViewType.ARCHIVE:
                return TrackingActionSource.ARCHIVE;
            case ViewType.ACTIVE:
                return TrackingActionSource.ACTIVE;
            case ViewType.ALL_PAGES:
                return TrackingActionSource.ALL_PAGES;
            case ViewType.CUSTOM:
                return TrackingActionSource.CUSTOM_VIEW;
            case ViewType.TEMPLATES:
                return TrackingActionSource.TEMPLATES_TAB;
            case FolderType.PROJECT:
                return TrackingActionSource.PROJECT;
        }

        return null;
    }

    resolveTypeFromTab(tabOrId: Tab | string): TrackingType | null {
        return this.resolveSourceFromTab(tabOrId) as TrackingType | null;
    }

    _resolveViewSource(tab: Tab): TrackingActionSource | null {
        const view = this.store.getters['view/byId'](tab.entityId);
        if (!view) return null;

        switch (view.type) {
            case ViewType.ARCHIVE:
                return TrackingActionSource.ARCHIVE;
            case ViewType.ACTIVE:
                return TrackingActionSource.ACTIVE;
            case ViewType.ALL_PAGES:
                return TrackingActionSource.ALL_PAGES;
            case ViewType.CUSTOM:
                return TrackingActionSource.CUSTOM_VIEW;
            case ViewType.TEMPLATES:
                return TrackingActionSource.TEMPLATES_TAB;
        }
        return null;
    }

    _resolveProjectSource(tab: Tab): TrackingActionSource | null {
        const project = this.store.getters['folder/byId'](tab.entityId);
        if (!project) return null;

        return TrackingActionSource.PROJECT;
    }

    resolveSourceFromTab(tabOrId: Tab | string): TrackingActionSource | null {
        let tab;
        if (typeof tabOrId === 'string') {
            tab = this.store.getters['tabs/byId'](tabOrId) as Tab | null;
        } else {
            tab = tabOrId;
        }
        if (!tab) return null;

        switch (tab.type) {
            case TabType.MY_DAY:
                return TrackingActionSource.MY_DAY;
            case TabType.DOCUMENT:
                return TrackingActionSource.PAGE;
            case TabType.NEW:
                return TrackingActionSource.NEW_TAB;
            case TabType.JIRA_APP:
                return TrackingActionSource.JIRA_TAB;
            case TabType.GITHUB_APP:
                return TrackingActionSource.GITHUB_TAB;
            case TabType.VIEW:
                return this._resolveViewSource(tab);
            case TabType.PROJECT:
                return this._resolveProjectSource(tab);
        }

        return null;
    }

    resolveSortBy(
        sortBy: SortingOptions,
    ): TrackingActionSourceMeta | undefined {
        switch (sortBy) {
            case SortingOptions.UPDATED_AT:
                return TrackingActionSourceMeta.SORT_BY_UPDATED_AT;
            case SortingOptions.TITLE:
                return TrackingActionSourceMeta.SORT_BY_TITLE;
            case SortingOptions.CREATED_AT:
                return TrackingActionSourceMeta.SORT_BY_CREATED_AT;
            case SortingOptions.MANUAL:
                return TrackingActionSourceMeta.SORT_BY_MANUAL;
        }

        return undefined;
    }

    resolveSortDirection(
        sortDirection: 'asc' | 'desc',
    ): TrackingActionSourceMeta {
        return sortDirection === 'asc'
            ? TrackingActionSourceMeta.SORT_DIRECTION_ASCENDING
            : TrackingActionSourceMeta.SORT_DIRECTION_DESCENDING;
    }

    resolveGroupBy(groupBy: GroupingOptions) {
        switch (groupBy) {
            case GroupingOptions.NONE:
                return TrackingAction.GROUP_BY_NONE;
            case GroupingOptions.PAGE_STATUS:
                return TrackingAction.GROUP_BY_STATUS;
            case GroupingOptions.FOLDER:
                return TrackingAction.GROUP_BY_FOLDER;
        }
    }

    resolveUpdatedDisplayProperty(
        displayProperties: string[],
        updatedDisplayProperties: string[],
    ): TrackingActionSourceMeta | undefined {
        const diff = xor(displayProperties, updatedDisplayProperties);

        if (!diff.length) return undefined;

        switch (diff[0]) {
            case 'status':
                return TrackingActionSourceMeta.STATUS;
            case 'icon':
                return TrackingActionSourceMeta.ICON;
            case 'tasks':
                return TrackingActionSourceMeta.TASKS;
            case 'date':
                return TrackingActionSourceMeta.DATE;
            case 'breadcrumbs':
                return TrackingActionSourceMeta.BREADCRUMBS;
            case 'updated':
                return TrackingActionSourceMeta.UPDATED;
            case 'created':
                return TrackingActionSourceMeta.CREATED;
            case 'type':
                return TrackingActionSourceMeta.TYPE;
            case 'priority':
                return TrackingActionSourceMeta.PRIORITY;
            case 'key':
                return TrackingActionSourceMeta.KEY;
            case 'labels':
                return TrackingActionSourceMeta.LABELS;
            case 'assignee':
                return TrackingActionSourceMeta.ASSIGNEE;
            case 'repository':
                return TrackingActionSourceMeta.REPOSITORY;
            case 'number':
                return TrackingActionSourceMeta.NUMBER;
            case 'links':
                return TrackingActionSourceMeta.LINKS;
            case 'comments':
                return TrackingActionSourceMeta.COMMENTS;
        }

        return undefined;
    }

    resolveFilterType(name: string) {
        switch (name) {
            case 'Labels':
            case 'Label':
                return TrackingActionSourceMeta.LABELS;
            case 'Folder':
                return TrackingActionSourceMeta.FOLDER;
            case 'Tasks':
                return TrackingActionSourceMeta.HAS_TASKS;
        }
    }

    resolveCalendarType(type: string) {
        switch (type) {
            case IntegrationType.GOOGLE_CALENDAR:
                return TrackingActionSourceMeta.GOOGLE_CALENDAR;
            case IntegrationType.ICS_CALENDAR:
                return TrackingActionSourceMeta.ICS_CALENDAR;
            case IntegrationType.APPLE_CALENDAR:
                return TrackingActionSourceMeta.APPLE_CALENDAR;
        }
    }

    initialize() {
        this.defaultProperties = {
            os: this.os,
            platform: this.platform,
            ...this.defaultProperties,
        };

        let appId = this.storage.get('app_id');
        const userId = this.storage.get('user_id');
        const defaultProperties: any = {};

        if (!appId) {
            appId = v4();
            this.storage.set('app_id', appId);
        }

        defaultProperties.app_id = appId;

        if (userId) {
            defaultProperties.user_id = userId;
        }

        this.defaultProperties = {
            ...this.defaultProperties,
            ...defaultProperties,
        };
    }

    identifyUser(user: { id: string; email?: string }) {
        if (user.id) {
            this.storage.set('user_id', user.id);

            this.defaultProperties = {
                ...this.defaultProperties,
                user_id: user.id,
            };
        }

        const event = {
            type: 'user',
            user_id: this.defaultProperties.user_id || null,
            email: user.email,
            timezone: this.defaultProperties.timezone,
        };

        this.sendEvent(event);
    }

    identifyApp() {
        const event = {
            type: 'app',
            user_id: this.defaultProperties.user_id || null,
            app_id: this.defaultProperties.app_id,
            os: this.defaultProperties.os,
            platform: this.defaultProperties.platform,
            version: this.defaultProperties.version,
            timezone: this.defaultProperties.timezone,
        };

        this.sendEvent(event);
    }

    getExtraProperties() {
        const properties: any = {};
        const referrer = document.referrer;

        if (referrer) {
            properties.referrer = referrer;
        }

        const bowser = Bowser.parse(window.navigator.userAgent);

        properties.browser = bowser.browser.name;
        properties.browser_version = bowser.browser.version;

        properties.client_os = bowser.os.name;
        properties.client_os_version = bowser.os.version;
        properties.client_os_version_name = bowser.os.versionName;

        properties.current_url = window.location.href;

        properties.screen_height = window.screen.height;
        properties.screen_width = window.screen.width;

        const activeVault = this.store.getters['vault/active'];

        properties.vault_id = activeVault?.id;
        properties.vault_type = activeVault?.type;

        return properties;
    }

    trackSessionEnd() {
        const sessionDuration =
            this.lastPingTimestamp - (this.sessionStart as number);
        this.trackEvent('session_end', {
            duration: Math.round(sessionDuration / 1000),
            session_id: this.sessionId,
            timestamp: this.lastPingTimestamp,
        });

        this.trackEventV2(TrackingType.SESSION, {
            action: TrackingAction.END,
            // @ts-ignore
            duration: Math.round(sessionDuration / 1000),
            // @ts-ignore
            session_id: this.sessionId,
            // @ts-ignore
            timestamp: this.lastPingTimestamp,
        });
    }

    trackSessionStart() {
        this.sessionId = v4();
        this.storage.set('session_id', this.sessionId);
        this.sessionStart = Date.now();

        this.trackEvent('session_start', {
            session_id: this.sessionId,
            timestamp: this.sessionStart,
        });
        this.trackEventV2(TrackingType.SESSION, {
            action: TrackingAction.START,
            // @ts-ignore
            session_id: this.sessionId,
            // @ts-ignore
            timestamp: this.sessionStart,
        });
        this.storage.set('session_start', this.sessionStart);
    }

    activityPing(_payload: any) {
        // const diff = Date.now() - this.lastPingTimestamp;

        // if (!this.sessionStart) {
        //     // first ever session;
        //     this.trackSessionStart();
        // }

        // if (diff > SESSION_TIMEOUT) {
        //     this.trackSessionEnd();
        //     this.trackSessionStart();
        // }

        // this.lastPingTimestamp = Date.now();
        // this.storage.set('last_ping_timestamp', this.lastPingTimestamp);
    }

    trackEventV2(eventType: TrackingType, properties: TrackingProperties) {
        // const event = {
        //     event_type: eventType,
        //     user_id: this.defaultProperties.user_id || null,
        //     cookie: this.defaultProperties.app_id,
        //     properties,
        //     meta: {
        //         ...this.getExtraProperties(),
        //         os: this.defaultProperties.os,
        //         platform: this.defaultProperties.platform,
        //         version: this.defaultProperties.version,
        //         timezone: this.defaultProperties.timezone,
        //     },
        // };

        // this.sendEventV2(event);
        // if (eventType !== TrackingType.SESSION) {
        //     this.activityPing(eventType);
        // }
    }

    trackEvent(
        eventType: string | TrackingType,
        properties: Record<string, any> = {},
    ) {
        // const event = {
        //     type: 'event',
        //     event_type: eventType,
        //     user_id: this.defaultProperties.user_id || null,
        //     app_id: this.defaultProperties.app_id,
        //     os: this.defaultProperties.os,
        //     platform: this.defaultProperties.platform,
        //     version: this.defaultProperties.version,
        //     timezone: this.defaultProperties.timezone,
        //     properties: {
        //         ...this.getExtraProperties(),
        //         ...properties,
        //     },
        // };

        // this.sendEvent(event);
    }

    sendEvent(event: any) {
        // if (!this.trackingUrl) return;
        // axios.post(this.trackingUrl, [event]).catch(e => {
        //     return null;
        // });
    }

    sendEventV2(event: any) {
        // if (!this.trackingUrlV2) return;
        // axios.post(this.trackingUrlV2, [event]).catch(e => {
        //     return null;
        // });
    }
}
