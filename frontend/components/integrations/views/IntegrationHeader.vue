<template>
    <div class="integration-header">
        <div class="integration-header__title">
            <div class="integration-header__title__icon">
                <slot name="icon"></slot>
            </div>
            <div class="integration-header__title__text">
                <slot name="title"></slot>
            </div>
        </div>
        <div class="integration-header__views">
            <div class="integration-header__views__menu">
                <IntegrationViewMenuItem
                    v-for="view in views"
                    :key="view.id"
                    :ref="`view-${view.id}`"
                    :active="
                        activeTab === view.id || view.id === activeContextMenuId
                    "
                    @click="handleClick(view)"
                    @contextmenu.prevent.stop.native="
                        handleContextMenu(view, $event)
                    "
                >
                    {{ view.name }}
                </IntegrationViewMenuItem>
                <IntegrationViewMenuItem :icon="true" @click="$emit('new')">
                    <InterfaceAdd1 size="12" />
                </IntegrationViewMenuItem>
            </div>
            <div class="integration-header__views__controls">
                <slot name="controls"></slot>
            </div>
        </div>
    </div>
</template>
<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import IntegrationViewMenuItem from '~/components/integrations/views/IntegrationViewMenuItem.vue';
import InterfaceAdd1 from '~/components/streamline/InterfaceAdd1.vue';
import IntegrationViewDropdown from '~/components/integrations/views/IntegrationViewDropdown.vue';

export type IntegrationViewFilter = {
    property: string;
    operation:
        | 'eq'
        | 'neq'
        | 'in'
        | 'notin'
        | 'gt'
        | 'lt'
        | 'gte'
        | 'lte'
        | 'isNotSet'
        | 'isSet'
        | 'overlap'
        | 'notoverlap'
        | 'containsAll';
    value: any;
};

export type IntegrationView = {
    id: string;
    default: boolean;
    groupBy: string; // TODO: enum
    sortBy: string; // TODO: enum
    sortDirection: string; // TODO: enum
    name: string;
    editing: boolean;
    filters: IntegrationViewFilter[];
    displayProperties: string[];
};

@Component({
    name: 'IntegrationHeader',
    components: { InterfaceAdd1, IntegrationViewMenuItem },
})
export default class IntegrationHeader extends Vue {
    @Prop({ required: true })
    views!: IntegrationView[];

    @Prop({ required: true })
    activeTab!: string;

    activeContextMenuId: string | null = null;

    $refs!: any;

    handleClick(view: IntegrationView) {
        if (view.id === this.activeTab) {
            // show dropdown
            this.$dropdown.show({
                component: IntegrationViewDropdown,
                name: 'view-dropdown',
                parent: this.$refs[`view-${view.id}`][0].$el as HTMLElement,
                bind: {
                    isDefault: view.default,
                },
                on: {
                    edit: () => {
                        this.$emit('edit', view.id);
                        this.$dropdown.hide('view-dropdown');
                    },
                    delete: () => {
                        this.$emit('delete', view.id);
                        this.$dropdown.hide('view-dropdown');
                    },
                    reload: () => {
                        this.$emit('reload', view.id);
                        this.$dropdown.hide('view-dropdown');
                    },
                    duplicate: () => {
                        this.$emit('duplicate', view.id);
                        this.$dropdown.hide('view-dropdown');
                    },
                },
            });
            return;
        }

        if (view.id === this.activeTab) return;

        this.$emit('select', view.id);
    }

    handleContextMenu(view: IntegrationView, event: MouseEvent) {
        this.activeContextMenuId = view.id;
        this.$contextMenu.show(event, {
            component: IntegrationViewDropdown,
            bind: {
                isDefault: view.default,
            },
            on: {
                edit: () => {
                    this.$emit('edit', view.id);
                    this.$contextMenu.hide();
                },
                delete: () => {
                    this.$emit('delete', view.id);
                    this.$contextMenu.hide();
                },
                reload: () => {
                    this.$emit('reload', view.id);
                    this.$dropdown.hide('view-dropdown');
                },
                duplicate: () => {
                    this.$emit('duplicate', view.id);
                    this.$dropdown.hide('view-dropdown');
                },
            },
            onClose: () => {
                this.activeContextMenuId = null;
            },
        });
    }
}
</script>
<style lang="scss" scoped>
.integration-header {
    padding: 0 14px 0px;
    user-select: none;
    background: var(--jira-panel-header-bg-color);
    -webkit-backdrop-filter: blur(12px); /* Safari 9+ */
    backdrop-filter: blur(12px); /* Chrome and Opera */

    &__controls {
        margin-left: auto;
    }

    &__title {
        padding: 0 6px;
        display: flex;
        gap: 12px;
        align-items: center;
        margin-bottom: 10px;

        &__icon {
            color: var(--integration-header-text-color);
        }

        &__text {
            color: var(--integration-header-text-color);
            @include font-h2;
        }
    }

    &__views {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--tab-divider-color);

        &__menu {
            padding: 2px 0px;
            display: flex;
            align-items: center;
            gap: 3px;
        }

        &__controls {
        }
    }
}
</style>
