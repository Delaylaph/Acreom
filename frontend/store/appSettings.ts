import { Context } from '@nuxt/types';
import Vue from 'vue';
import { uniq } from 'lodash';
import { DateFormat, ThemeOptions, TimeFormat } from '@/helpers/date';
import { APP_COLORS, Color, IntegrationType } from '~/constants';

interface AppState {
    editorOptions: {
        wide: boolean;
        contentWidth: string;
        showInfoPanel: boolean;
        spellcheck: boolean;
        defaultTags: boolean;
        agendaShowCompleted: boolean;
    };
    calendarOptions: {
        weekdayStart: number;
    };
    dateTimeOptions: {
        timeFormat: TimeFormat;
        dateFormat: DateFormat;
    };
    platformOptions: {
        windowsTray: boolean;
    };
    quickCaptureOptions: {
        allowQuickCapture: boolean;
    };
    assistantOptions: {
        usage: number;
        lastUsageDate: Date;
    };
    integrationPlaceholders: {
        dismissed: IntegrationType[];
    };
    theme: ThemeOptions;
    prefersColorScheme: ThemeOptions.DARK | ThemeOptions.LIGHT;
    appColor: Color;
}

const initializePrefersColorScheme = ():
    | ThemeOptions.DARK
    | ThemeOptions.LIGHT => {
    if (!window.matchMedia) return ThemeOptions.DARK;

    const isDarkTheme = window.matchMedia(
        '(prefers-color-scheme: dark)',
    ).matches;

    return isDarkTheme ? ThemeOptions.DARK : ThemeOptions.LIGHT;
};

export const state: () => AppState = () => ({
    editorOptions: {
        wide: false,
        contentWidth: '800',
        showInfoPanel: false,
        spellcheck: false,
        defaultTags: false,
        agendaShowCompleted: true,
    },
    calendarOptions: {
        weekdayStart: 0,
    },
    dateTimeOptions: {
        timeFormat: TimeFormat.HOUR_12,
        dateFormat: DateFormat.EU,
    },
    platformOptions: {
        windowsTray: true,
    },
    quickCaptureOptions: {
        allowQuickCapture: true,
    },
    assistantOptions: {
        usage: 0,
        lastUsageDate: new Date(),
    },
    theme: ThemeOptions.DARK,
    prefersColorScheme: initializePrefersColorScheme(),
    appColor: Color.TURQUOISE,
    integrationPlaceholders: {
        dismissed: [],
    },
});

export const getters = {
    editorOptions(state: AppState) {
        return state.editorOptions;
    },
    calendarOptions(state: AppState) {
        return state.calendarOptions;
    },
    calendarWeekDays(state: AppState) {
        const startDay = state.calendarOptions.weekdayStart;
        const weekdays = [];

        for (let i = 0; i < 7; i++) {
            weekdays.push((i + startDay) % 7);
        }

        return weekdays;
    },
    dateTimeOptions(state: AppState) {
        return state.dateTimeOptions;
    },
    platformOptions(state: AppState) {
        return state.platformOptions;
    },
    quickCaptureOptions(state: AppState) {
        return state.quickCaptureOptions;
    },
    assistantOptions(state: AppState) {
        return state.assistantOptions;
    },
    selectedTheme(state: AppState) {
        return state.theme;
    },
    theme(state: AppState): ThemeOptions.DARK | ThemeOptions.LIGHT {
        if (state.theme === ThemeOptions.OS) {
            return state.prefersColorScheme;
        }

        return state.theme;
    },
    appColor(state: AppState) {
        const currentTheme =
            state.theme === ThemeOptions.OS
                ? state.prefersColorScheme
                : state.theme;

        return {
            id: state.appColor,
            ...APP_COLORS[state.appColor][currentTheme],
        };
    },
    dismissedIntegrationPlaceholders(state: AppState) {
        return state.integrationPlaceholders.dismissed ?? [];
    },
};

export const mutations = {
    initialize(
        state: AppState & Record<string, any>,
        value: Partial<AppState>,
    ) {
        Object.keys(value).forEach((key: string) => {
            const val = (value as any)[key]; // TODO: fix types

            if (typeof val === 'object') {
                Vue.set(state, key, {
                    ...state[key],
                    ...val,
                });
                return;
            }

            Vue.set(state, key, val || state[key]);
        });
    },
    updateEditorOptions(state: AppState, value: AppState['editorOptions']) {
        state.editorOptions = { ...state.editorOptions, ...value };
    },
    updateCalendarOptions(state: AppState, value: AppState['calendarOptions']) {
        state.calendarOptions = { ...state.calendarOptions, ...value };
    },
    updateDateTimeOptions(state: AppState, value: AppState['dateTimeOptions']) {
        state.dateTimeOptions = { ...state.dateTimeOptions, ...value };
    },
    updatePlatformOptions(state: AppState, value: AppState['platformOptions']) {
        state.platformOptions = { ...state.platformOptions, ...value };
    },
    updateQuickCaptureOptions(
        state: AppState,
        value: AppState['quickCaptureOptions'],
    ) {
        state.quickCaptureOptions = { ...state.quickCaptureOptions, ...value };
    },
    updateAssistantOptions(
        state: AppState,
        value: AppState['assistantOptions'],
    ) {
        state.assistantOptions = { ...state.assistantOptions, ...value };
    },
    updateThemeOptions(state: AppState, value: ThemeOptions) {
        state.theme = value;
    },
    updateAppColor(state: AppState, value: Color) {
        state.appColor = value;
    },
    updatePrefersColorScheme(
        state: AppState,
        value: ThemeOptions.DARK | ThemeOptions.LIGHT,
    ) {
        state.prefersColorScheme = value;
    },
    dismissIntegrationPlaceholder(state: AppState, value: any) {
        state.integrationPlaceholders.dismissed = [
            ...new Set([...state.integrationPlaceholders.dismissed, value]),
        ];
    },
};

export const actions = {
    initialize(this: Context, { commit }: any) {
        const editorOptions: AppState['editorOptions'] | null =
            this.$appStorage.get('editorOptions') || {};
        const calendarOptions: AppState['calendarOptions'] | null =
            this.$appStorage.get('calendarOptions') || {};
        const dateTimeOptions: AppState['dateTimeOptions'] | null =
            this.$appStorage.get('dateTimeOptions') || {};
        const platformOptions: AppState['platformOptions'] | null =
            this.$appStorage.get('platformOptions') || {};
        const quickCaptureOptions: AppState['quickCaptureOptions'] | null =
            this.$appStorage.get('quickCaptureOptions') || {};
        const assistantOptions: AppState['assistantOptions'] | null =
            this.$appStorage.get('assistantOptions') || {};
        const theme: AppState['theme'] =
            this.$appStorage.get('theme') || ThemeOptions.DARK;
        const appColor: AppState['appColor'] =
            this.$appStorage.get('appColor') || Color.TURQUOISE;
        const integrationPlaceholders: AppState['integrationPlaceholders'] =
            this.$appStorage.get('integrationPlaceholders') || {
                dismissed: [],
            };

        const data = {
            editorOptions,
            calendarOptions,
            dateTimeOptions,
            platformOptions,
            quickCaptureOptions,
            assistantOptions,
            theme,
            appColor,
            integrationPlaceholders,
        };

        commit('initialize', data);
    },
    refresh(this: Context, { dispatch }: any) {
        return dispatch('initialize');
    },
    updateEditorOptions(
        this: Context,
        { commit, getters }: any,
        value: Partial<AppState['editorOptions']>,
    ) {
        console.log('updateEditorOptions', value);
        commit('updateEditorOptions', value);
        window?.$nuxt.$emit('title-editor:size-changed');
        this.$appStorage.set('editorOptions', {
            ...getters.editorOptions,
            ...value,
        });
    },
    updateCalendarOptions(
        this: Context,
        { commit, getters }: any,
        value: Partial<AppState['calendarOptions']>,
    ) {
        commit('updateCalendarOptions', value);
        this.$appStorage.set('calendarOptions', {
            ...getters.calendarOptions,
            ...value,
        });
    },
    updateDateTimeOptions(
        this: Context,
        { commit, getters }: any,
        value: Partial<AppState['dateTimeOptions']>,
    ) {
        commit('updateDateTimeOptions', value);
        this.$appStorage.set('dateTimeOptions', {
            ...getters.dateTimeOptions,
            ...value,
        });
    },
    updatePlatformOptions(
        this: Context,
        { commit, getters }: any,
        value: Partial<AppState['platformOptions']>,
    ) {
        commit('updatePlatformOptions', value);
        this.$appStorage.set('platformOptions', {
            ...getters.platformOptions,
            ...value,
        });
    },
    updateQuickCaptureOptions(
        this: Context,
        { commit, getters }: any,
        value: Partial<AppState['quickCaptureOptions']>,
    ) {
        commit('updateQuickCaptureOptions', value);
        this.$appStorage.set('quickCaptureOptions', {
            ...getters.quickCaptureOptions,
            ...value,
        });
    },
    updateAssistantOptions(
        this: Context,
        { commit, getters }: any,
        value: Partial<AppState['assistantOptions']>,
    ) {
        commit('updateAssistantOptions', value);
        this.$appStorage.set('assistantOptions', {
            ...getters.assistantOptions,
            ...value,
        });
    },
    resetAssistantUsage(
        this: Context,
        { commit, getters }: any,
        value: Partial<AppState['assistantOptions']>,
    ) {
        commit('updateAssistantOptions', {
            usage: 0,
            lastUsageDate: new Date(),
        });
        this.$appStorage.set('assistantOptions', {
            ...getters.assistantOptions,
            ...value,
        });
    },
    updateThemeOptions(this: Context, { commit }: any, value: ThemeOptions) {
        commit('updateThemeOptions', value);
        this.$appStorage.set('theme', value);
    },
    updateAppColor(this: Context, { commit }: any, value: Color) {
        commit('updateAppColor', value);
        this.$appStorage.set('appColor', value);
    },
    updatePrefersColorScheme(
        this: Context,
        { commit }: any,
        value: ThemeOptions.LIGHT | ThemeOptions.DARK,
    ) {
        commit('updatePrefersColorScheme', value);
    },
    dismissIntegrationPlaceholder(
        this: Context,
        { commit, getters }: any,
        value: any,
    ) {
        commit('dismissIntegrationPlaceholder', value);
        this.$appStorage.set('integrationPlaceholders', {
            dismissed: getters.dismissedIntegrationPlaceholders,
        });
    },
};
