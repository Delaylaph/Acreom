<template>
    <div class="page-list-controls-wrapper">
        <button
            ref="pageListControlsDropdown"
            class="page-list-controls-wrapper__settings"
            :class="{ active, full }"
            @click="openControlsDropdown"
        >
            <InterfaceSettingSliderVertical size="14" class="icon" />
            <span v-if="full">Add Filters</span>
        </button>
    </div>
</template>
<script lang="ts">
import { Component, Inject, Prop, Vue } from 'vue-property-decorator';
import InterfaceSettingSliderVertical from '~/components/streamline/InterfaceSettingSliderVertical.vue';
import { PageListSymbols, TabSymbols } from '~/constants/symbols';
import PageListControlsDropdown from '~/components/page-list/list/header/PageListControlsDropdown.vue';
import CButton from '~/components/CButton.vue';
import { TrackingAction } from '~/@types/tracking';
import { PageListType } from '~/constants';
import InterfaceArrowsCornerUpRight from '~/components/streamline/InterfaceArrowsCornerUpRight.vue';
import InterfaceAdd1 from '~/components/streamline/InterfaceAdd1.vue';

@Component({
    name: 'PageListControlsWrapper',
    computed: {
        PageListType() {
            return PageListType;
        },
    },
    components: {
        InterfaceAdd1,
        InterfaceArrowsCornerUpRight,
        CButton,
        InterfaceSettingSliderVertical,
    },
})
export default class PageListControlsWrapper extends Vue {
    @Prop({ default: false })
    full!: boolean;

    @Prop()
    definition!: any;
    
    @Prop()
    pages!: [];

    @Prop({ default: true })
    showFilterOptions!: boolean;

    @Prop({ default: true })
    showGroupOptions!: boolean;

    @Inject(TabSymbols.TAB_ID)
    tabId!: string;

    @Inject(TabSymbols.ENTITY_ID)
    entityId!: string;

    @Inject(PageListSymbols.TYPE)
    pageListType!: PageListType;

    $refs!: {
        pageListControlsDropdown: HTMLButtonElement;
    };

    active: boolean = false;

    get tabData() {
        return this.$tabs.getTabData(this.tabId);
    }

    openControlsDropdown() {
        this.active = true;
        this.$dropdown.show({
            parent: this.$refs.pageListControlsDropdown,
            component: PageListControlsDropdown,
            retainFocus: true,
            onClose: () => {
                this.active = false;
            },
            bind: {
                tabId: this.tabId,
                entityId: this.entityId,
                showFilterOptions: this.showFilterOptions,
                showDisplayOptions: !this.full,
                showGroupOptions: this.showGroupOptions,
                definitions: this.definition,
                pageListType: this.pageListType,
                pages: this.pages,
            },
            on: {
                'update-filters': (data: any) => {
                    this.$emit('update', data);
                },
                'update-display-options': (data: any) => {
                    this.$emit('update-display', data);
                },
            },
            popperOptions: {
                placement: 'bottom-end',
            },
        });

        const type = this.$tracking.resolveTypeFromTab(this.tabId);
        if (!type) return;
        this.$tracking.trackEventV2(type, {
            action: TrackingAction.OPEN_DROPDOWN,
        });
    }

    mounted() {
        if (this.tabData.showControls) {
            this.openControlsDropdown();
            this.$tabs.updateTabData(this.tabId, {
                ...this.tabData,
                showControls: false,
            });
        }
    }
}
</script>
<style lang="scss" scoped>
.page-list-controls-wrapper {
    display: flex;
    align-items: center;
    gap: 6px;
    &__settings {
        color: var(--tab-controls-icon-color);
        padding: 7px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;

        &:hover,
        &.active {
            background: var(--tab-controls-bg-color__hover);
            color: var(--tab-controls-icon-color__hover);
        }

        .icon {
            flex-shrink: 0;
        }

        span {
            @include font12-600;
            width: 100%;
        }

        &.full {
            padding: 5px 8px;
            gap: 6px;
            color: var(--document-link-text-color);
            border: 1px solid
                var(--calendar-header-controls-border-color__today);

            &:hover,
            &.active {
                color: var(--document-link-text-color__hover);
                background: var(--tab-controls-bg-color__hover);
            }
        }
    }
}
</style>
