<template>
    <div class="appearance">
        <div class="appearance__title">Appearance</div>
        <div class="appearance__wrapper">
            <div class="appearance__wrapper__option">
                <div class="appearance__wrapper__option__title">Theme</div>
                <div class="appearance__wrapper__option__sub-title">
                    Change the app theme.
                </div>
                <div class="appearance__wrapper__option__theme-picker">
                    <div
                        class="
                            appearance__wrapper__option__theme-picker__option
                        "
                        :class="{
                            active:
                                $store.getters['appSettings/selectedTheme'] ===
                                'DARK',
                        }"
                        @click="updateTheme('DARK')"
                    >
                        <img
                            :src="`/components/appearance/dark-theme-preview-1x-${theme}.png`"
                            :srcset="`/components/appearance/dark-theme-preview-1x-${theme}.png 1x,
                                  /components/appearance/dark-theme-preview-2x-${theme}.png 2x`"
                            alt="Dark Theme"
                        />
                        <div
                            class="
                                appearance__wrapper__option__theme-picker__option__name
                            "
                            :class="{
                                active:
                                    $store.getters[
                                        'appSettings/selectedTheme'
                                    ] === 'DARK',
                            }"
                        >
                            Dark
                        </div>
                    </div>
                    <div
                        class="
                            appearance__wrapper__option__theme-picker__option
                        "
                        :class="{
                            active:
                                $store.getters['appSettings/selectedTheme'] ===
                                'LIGHT',
                        }"
                        @click="updateTheme('LIGHT')"
                    >
                        <img
                            :src="`/components/appearance/light-theme-preview-1x-${theme}.png`"
                            :srcset="`/components/appearance/light-theme-preview-1x-${theme}.png 1x, /components/appearance/light-theme-preview-2x-${theme}.png 2x`"
                            alt="Light Theme"
                        />
                        <div
                            class="
                                appearance__wrapper__option__theme-picker__option__name
                            "
                            :class="{
                                active:
                                    $store.getters[
                                        'appSettings/selectedTheme'
                                    ] === 'LIGHT',
                            }"
                        >
                            Light
                        </div>
                    </div>
                    <div
                        class="
                            appearance__wrapper__option__theme-picker__option
                        "
                        :class="{
                            active:
                                $store.getters['appSettings/selectedTheme'] ===
                                'OS',
                        }"
                        @click="updateTheme('OS')"
                    >
                        <img
                            :src="`/components/appearance/os-theme-preview-1x-${theme}.png`"
                            :srcset="`/components/appearance/os-theme-preview-1x-${theme}.png 1x, /components/appearance/os-theme-preview-2x-${theme}.png 2x`"
                            alt="Sync with OS"
                        />
                        <div
                            class="
                                appearance__wrapper__option__theme-picker__option__name
                            "
                            :class="{
                                active:
                                    $store.getters[
                                        'appSettings/selectedTheme'
                                    ] === 'OS',
                            }"
                        >
                            Sync with OS
                        </div>
                    </div>
                </div>
            </div>

            <div class="appearance__wrapper__option">
                <div class="appearance__wrapper__option__title">
                    Accent Color
                    <span>PRO</span>
                </div>
                <div class="appearance__wrapper__option__sub-title">
                    Adjust the highlights and accent color across the app.
                </div>
                <div
                    class="appearance__wrapper__option__accent-picker"
                    :class="{
                        disabled: !canChangeAccentColor,
                    }"
                >
                    <div
                        v-for="color of accentColors"
                        :key="color.id"
                        class="
                            appearance__wrapper__option__accent-picker__color
                        "
                        :class="{ active: color.id === accentColorIndex.id }"
                        :style="{ background: color.color }"
                        @click="updateAccentColorIndex(color.id)"
                    ></div>
                </div>
            </div>

            <div class="appearance__wrapper__option">
                <div class="appearance__wrapper__option__title">
                    Content Width
                </div>
                <div class="appearance__wrapper__option__sub-title">
                    Adjust the width of app content and editor.
                </div>
                <div class="appearance__wrapper__option__content-width-picker">
                    <div
                        class="
                            appearance__wrapper__option__content-width-picker__option
                        "
                        @click="updateEditorWidth(false, contentWidth)"
                    >
                        <div
                            class="
                                appearance__wrapper__option__content-width-picker__option__content
                            "
                            :class="{ active: !isWideEditor }"
                        >
                            <div
                                class="
                                    appearance__wrapper__option__content-width-picker__option__content__title
                                    narrow
                                "
                            >
                                Title
                            </div>
                            <div
                                class="
                                    appearance__wrapper__option__content-width-picker__option__content__body
                                    narrow
                                "
                            >
                                Arthur Dent is an anxious thirty-year-old man
                                who lives in a small house in England. One
                                morning,
                            </div>
                        </div>
                        <div
                            class="
                                appearance__wrapper__option__content-width-picker__option__name
                            "
                            :class="{ active: !isWideEditor }"
                        >
                            Narrow <input type="number" v-model="contentWidth" @change="updateEditorWidth(false, contentWidth)"></input>
                        </div>
                    </div>
                    <div
                        class="
                            appearance__wrapper__option__content-width-picker__option
                        "
                        :class="{ active: !isWideEditor }"
                        @click="updateEditorWidth(true, 700)"
                    >
                        <div
                            class="
                                appearance__wrapper__option__content-width-picker__option__content
                            "
                            :class="{ active: isWideEditor }"
                        >
                            <div
                                class="
                                    appearance__wrapper__option__content-width-picker__option__content__title
                                    wide
                                "
                            >
                                Title
                            </div>
                            <div
                                class="
                                    appearance__wrapper__option__content-width-picker__option__content__body
                                    wide
                                "
                            >
                                Arthur Dent is an anxious thirty-year-old man
                                who lives in a small house in England. One
                                morning, Arthur awakes and sees a bulldozer
                                outside his home as the local council wishes to
                                demolish Arthur's house to
                            </div>
                        </div>
                        <div
                            class="
                                appearance__wrapper__option__content-width-picker__option__name
                            "
                            :class="{ active: isWideEditor }"
                        >
                            Wide
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ThemeOptions } from '~/helpers/date';
import CSwitch from '~/components/CSwitch.vue';
import { EditorNarrowIcon, EditorWideIcon } from '~/components/icons';
import ASelect from '~/components/ASelect.vue';
import { APP_COLORS, Color } from '~/constants';
import accessControl from '~/plugins/access-control';
import {
    TrackingAction,
    TrackingActionSource,
    TrackingActionSourceMeta,
    TrackingType,
} from '~/@types/tracking';

@Component({
    name: 'Appearance',
    methods: { accessControl },
    components: {
        ASelect,
        CSwitch,
        EditorNarrowIcon,
        EditorWideIcon,
    },
})

export default class Preferences extends Vue {
    contentWidth: string = this.$store.getters['appSettings/editorOptions'].contentWidth;

    get theme() {
        return this.$store.getters['appSettings/theme'].toLowerCase();
    }

    get accentColors() {
        const theme: ThemeOptions.DARK | ThemeOptions.LIGHT =
            this.$store.getters['appSettings/theme'];

        return (Object.keys(APP_COLORS) as Color[]).map(key => {
            return {
                id: key,
                color: APP_COLORS[key][theme].COLOR,
            };
        });
    }

    get canChangeAccentColor() {
        return (
            this.$accessControl.isProActive || this.$accessControl.isTrialActive
        );
    }

    get accentColorIndex() {
        if (!this.canChangeAccentColor) return Color.TURQUOISE;

        return this.$store.getters['appSettings/appColor'];
    }

    get isWindows() {
        return this.$config.os === 'windows';
    }

    updateAccentColorIndex(value: string) {
        if (!this.canChangeAccentColor) {
            this.$vfm.show({
                component: () => import('~/components/modal/UpgradeModal.vue'),
            });
            return;
        }

        this.$store.dispatch('appSettings/updateAppColor', value);
    }

    get isWideEditor() {
        return this.$store.getters['appSettings/editorOptions'].wide;
    }

    updateEditorWidth(wide: boolean, contentWidth: string) {
        this.$store.dispatch('appSettings/updateEditorOptions', {
            wide,
            contentWidth: contentWidth,
        });
        this.$nuxt.$emit('tab-resize');

        let sourceMeta = null;
        if (wide) sourceMeta = TrackingActionSourceMeta.WIDE;
        if (!wide) sourceMeta = TrackingActionSourceMeta.NARROW;

        this.$tracking.trackEventV2(TrackingType.SETTINGS, {
            action: TrackingAction.SET_CONTENT_WIDTH,
            sourceMeta,
        });
    }

    updateTheme(value: string) {
        this.$store.dispatch('appSettings/updateThemeOptions', value);

        let sourceMeta = null;

        if (value === 'DARK') sourceMeta = TrackingActionSourceMeta.DARK;
        if (value === 'LIGHT') sourceMeta = TrackingActionSourceMeta.LIGHT;
        if (value === 'OS') sourceMeta = TrackingActionSourceMeta.SYSTEM;

        this.$tracking.trackEventV2(TrackingType.SETTINGS, {
            action: TrackingAction.CHANGE_THEME,
            sourceMeta,
        });
    }
}
</script>

<style lang="scss" scoped>
.appearance {
    user-select: none;
    cursor: default;
    padding: 30px;

    &__title {
        @include font14-600;
        color: var(--settings-modal-title-color);
    }

    &__wrapper {
        margin-top: 20px;

        &__option {
            padding-bottom: 20px;
            border-bottom: 1px solid var(--tab-divider-color);

            &:not(:first-of-type) {
                margin-top: 20px;
            }

            &__title {
                @include font12-600;
                display: flex;
                align-items: center;
                gap: 6px;
                color: var(--settings-modal-title-color);
                margin-bottom: 4px;

                span {
                    @include proBadge;
                }
            }

            &__sub-title {
                @include font12-500;
                color: var(--settings-modal-option-description-color);
            }

            &__content-width-picker {
                display: flex;
                align-items: center;
                gap: 20px;
                margin-top: 20px;

                @media (max-width: 768px) {
                    flex-direction: column;
                }

                &__option {
                    width: 50%;

                    @media (max-width: 768px) {
                        width: 100%;
                    }

                    &__content {
                        border-radius: 12px;
                        margin-bottom: 10px;
                        color: var(--settings-modal-title-color);
                        padding: 14px 10px 10px;
                        max-height: 110px;
                        overflow: hidden;
                        background: var(
                            --settings-modal-appearance-content-width-bg-color
                        );

                        &:hover {
                            background: var(
                                --settings-modal-appearance-content-width-bg-color__active
                            );
                        }

                        &.active {
                            background: var(
                                --settings-modal-appearance-content-width-bg-color__active
                            );
                            outline: 2px solid var(--accent-color);
                        }

                        &__title {
                            @include font11-500;

                            &.narrow {
                                max-width: 100px;
                                width: 100%;
                                margin: 0 auto;
                            }
                        }

                        &__body {
                            font-size: 8px;
                            font-weight: 500;
                            line-height: 17px;

                            &.narrow {
                                max-width: 100px;
                                margin: 0 auto;
                            }
                        }
                    }

                    &__name {
                        @include font12-400;
                        color: var(
                            --settings-modal-appearance-option-text-color
                        );

                        &.active {
                            color: var(
                                --settings-modal-appearance-option-text-color__active
                            );
                        }
                    }
                }
            }

            &__theme-picker {
                display: flex;
                align-items: center;
                gap: 20px;
                margin-top: 20px;

                @media (max-width: 768px) {
                    flex-direction: column;
                }

                &__option {
                    border-radius: 12px;

                    &.active img {
                        border-radius: 12px;
                        outline: 2px solid var(--accent-color);
                    }

                    &__name {
                        @include font12-400;
                        margin-top: 10px;
                        color: var(
                            --settings-modal-appearance-option-text-color
                        );

                        &.active {
                            color: var(
                                --settings-modal-appearance-option-text-color__active
                            );
                        }
                    }
                }
            }

            &__accent-picker {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-top: 20px;
                flex-wrap: wrap;

                &.disabled {
                    opacity: 0.2;
                }

                &__color {
                    border-radius: 50%;
                    width: 20px;
                    height: 20px;
                    border: 2px solid var(--modal-bg-color);
                    flex-shrink: 0;

                    &.active {
                        outline: 2px solid var(--accent-color);
                    }
                }
            }
        }
    }
}
</style>
