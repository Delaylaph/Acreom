<template>
    <button
        class="page-section-header"
        :class="{ focused }"
        @click="$emit('collapse', sectionId)"
    >
        <div class="page-section-header__collapse">
            <InterfaceGeometricTriangle
                v-if="!collapsed"
                size="6"
                style="transform: rotate(180deg)"
                class="collapse-icon"
            />
            <InterfaceGeometricTriangle
                v-else
                size="6"
                style="transform: rotate(90deg)"
                class="collapse-icon"
            />
        </div>
        <component
            :is="icon"
            v-if="groupBy === GroupingOptions.PAGE_STATUS"
            class="icon"
            :style="{ color: workflowIconColor }"
        />
        <div v-else-if="icon" class="page-section-header__custom-icon">
            <span>{{ icon }}</span>
        </div>
        <div v-else class="page-section-header__icon">
            <InterfaceFolder class="icon" size="14" />
        </div>
        {{ prettyNameInternal }}
        <span class="page-section-header__counter">{{ count }}</span>
    </button>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import InterfaceGeometricTriangle from '~/components/streamline/InterfaceGeometricTriangle.vue';
import { GroupingOptions } from '~/constants';
import InterfaceFolder from '~/components/streamline/InterfaceFolder.vue';

@Component({
    name: 'PageStatusHeader',
    computed: {
        GroupingOptions() {
            return GroupingOptions;
        },
    },
    components: {
        InterfaceFolder,
        InterfaceGeometricTriangle,
    },
})
export default class PageStatusHeader extends Vue {
    @Prop()
    sectionId!: string;

    @Prop()
    sectionName!: any;

    @Prop()
    count!: number;

    @Prop()
    collapsed!: boolean;

    @Prop({ default: false })
    focused!: boolean;

    @Prop()
    groupBy!: GroupingOptions;

    get workflowIconColor() {
        // @ts-ignore
        return this.$utils.page.getWorkflowIcon(this.sectionId).color;
    }

    get icon() {
        if (this.groupBy === GroupingOptions.PAGE_STATUS) {
            // @ts-ignore
            return this.$utils.page.getWorkflowIcon(this.sectionId).icon;
        }
        if (this.groupBy === GroupingOptions.FOLDER) {
            return this.$entities.folder.getIcon(this.sectionId);
        }
        return null;
    }

    prettyNameInternal: string = '';

    @Watch('sectionName', { immediate: true })
    onSectionNameChanged(newVal: string) {
    if (this.groupBy !== GroupingOptions.PAGE_STATUS && this.groupBy !== GroupingOptions.FOLDER) {
        const parts = newVal.split(':');
        const prettyName = parts[1] ?? newVal;
        this.prettyNameInternal = prettyName.charAt(0).toUpperCase() + prettyName.slice(1);
    } else {
        this.prettyNameInternal = newVal;
    }
  }
}
</script>

<style scoped lang="scss">
.page-section-header {
    @include font14-600;
    color: var(--page-status-header-color);
    padding: 8px 8px 8px 0;
    border-bottom: 1px solid var(--page-status-header-border-color);
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
    user-select: none;
    cursor: default;

    width: 100%;
    position: relative;

    &.focused,
    &:hover {
        .page-section-header__collapse {
            color: var(--jira-section-header-text-color__active);
        }
    }

    .icon {
        color: var(--page-status-header-icon-color);
    }

    &__counter {
        @include font12-700;
        border-radius: 11.5px;
        background: var(--page-status-header-page-counter-background);
        padding: 0px 7px;
        text-align: center;
        color: var(--page-status-header-page-counter-text-color);
    }

    &__collapse {
        flex-shrink: 0;
        color: var(--task-tab-collapse-button-color);
    }

    &__icon {
        pointer-events: none;
        padding: 1px;
        flex-shrink: 0;
        color: var(--sidebar-icon-color);
    }

    &__custom-icon {
        pointer-events: none;
        flex-shrink: 0;
        color: var(--sidebar-icon-color);
    }
}
</style>
