<template>
    <div class="view-filter-controls">
        <PageListSourceControls
            v-if="view?.type === ViewType.ALL_PAGES"
            class="view-filter-controls__item"
            :tab-id="tabId"
            :source="sourceDef"
            @update="handleSourceChange"
        />
        <hr v-if="view?.type === ViewType.ALL_PAGES" />
        <div class="view-filter-controls__title">Filters</div>
        <template v-for="definition in availableControls">
            <PageDefinitionControl
                :key="definition.name"
                class="view-filter-controls__item"
                :name="definition.name"
                :items="definition.items"
                :selected-items="definition.selectedItems"
                :multiselect="definition.multiselect"
                :search-placeholder="definition.searchPlaceholder"
                :placeholder="definition.placeholder"
                @update="definition.update"
                @close="definition.close"
            />
        </template>
        <PageListTasksControls
            class="view-filter-controls__item"
            :tab-id="tabId"
            :value="taskDefinition"
            @update="handleHasTasksUpdate($event)"
        />
    </div>
</template>
<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import isEmpty from 'lodash/isEmpty';
import PageFilterByLabel from '~/components/view/controls/filter/PageFilterByLabel.vue';
import PageFilterByFolder from '~/components/view/controls/filter/PageFilterByFolder.vue';
import PageListSourceControls from '~/components/view/controls/filter/PageListSourceControls.vue';
import PageListTasksControls from '~/components/view/controls/filter/PageListTasksControls.vue';
import { ViewType } from '~/constants';
import { ViewPropertyDefinition } from '~/components/view/model';
import PageDefinitionControl from '~/components/view/controls/filter/PageDefinitionControl.vue';
import {
    TrackingAction,
    TrackingActionSource,
    TrackingActionSourceMeta,
} from '~/@types/tracking';

@Component({
    name: 'PageListControlsDropdown',
    computed: {
        ViewType() {
            return ViewType;
        },
    },
    components: {
        PageDefinitionControl,
        PageListTasksControls,
        PageListSourceControls,
        PageFilterByFolder,
        PageFilterByLabel,
    },
})
export default class PageListControlsDropdown extends Vue {
    @Prop({})
    tabId!: string;

    @Prop()
    pages!: [];

    @Prop({})
    entityId!: string;

    @Prop({ default: () => [] })
    definitions!: ViewPropertyDefinition[];

    get sourceDef() {
        return this.definitions.find(
            definition => definition.property === 'dailyDoc',
        );
    }

    get taskDefinition() {
        return this.definitions.some(
            definition => definition.property === 'tasks',
        );
    }

    get availableControls() {
        const options = this.$entities.view.viewSelectOptions();
        
        const availableControls: any = [];

        for (let key in options) {
            let controlDefinition: any = null;

            if (key === 'labels') {
                controlDefinition = {
                    id: 'labels',
                    name: 'Label',
                    placeholderSuffix: 'labels',
                    property: 'labels',
                    operation: 'overlap',
                };
            } else if (key === 'projectId') {
                controlDefinition = {
                    id: 'projectId',
                    name: 'Folder',
                    placeholderSuffix: 'folders',
                    property: 'projectId',
                    operation: 'overlap',
                };
            } else if (key === 'project') {
                controlDefinition = {
                    id: 'project',
                    name: 'Project',
                    placeholderSuffix: 'projects',
                    property: 'project',
                    operation: 'overlap',
                };
            } else {
                controlDefinition = {
                    id: key,
                    name: key.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()),
                    placeholderSuffix: key.replace(/_/g, ' '),
                    property: 'labels',
                    operation: 'overlap',
                };
            }

            if(this.hasPagesWithFilterProperty(controlDefinition.id)) {
                availableControls.push({
                    ...this.$entities.view.createDefinitionControl(
                        controlDefinition,
                        this.definitions,
                        options[key],
                    ),
                    update: (value: any) => {
                        const fn = this.$entities.view.createUpdateWrapper(
                            controlDefinition,
                            this.definitions,
                        );
                        const res = fn(value);
                        this.$emit('update', res);
                    },
                    close: (value: any) => {
                        if (!value || isEmpty(value)) {
                            const definition = this.definitions.filter(
                                definition =>
                                    definition.id !==
                                    controlDefinition.id,
                            );
                            this.$emit('update', definition);
                        }
                    },
                });
            }
            
        };
        return availableControls;
    }

    get view() {
        return this.$entities.view.getViewById(this.entityId);
    }

    hasPagesWithFilterProperty(defId: string) {
        if(defId === 'project' || defId === 'labels' || defId === 'projectId') {
            return true;
        } else if (this.pages.some((page: any) => page.labels.some((label: string) => label.includes(defId)))) {
            return true;
        }
        return false;
    }

    handleSourceChange(sourceDef: ViewPropertyDefinition) {
        if (
            !this.definitions.some(
                definition => definition.property === 'dailyDoc',
            )
        ) {
            this.$emit('update', [...this.definitions, sourceDef]);
            return;
        }
        this.$emit(
            'update',
            this.definitions.map(definition =>
                definition.property === 'dailyDoc' ? sourceDef : definition,
            ),
        );
    }

    handleHasTasksUpdate(value: any) {
        if (value) {
            this.$emit('update', [
                ...this.definitions,
                {
                    property: 'tasks',
                    operation: 'has',
                },
            ]);
            const type = this.$tracking.resolveTypeFromView(this.entityId);
            if (type) {
                this.$tracking.trackEventV2(type, {
                    action: TrackingAction.ADD_FILTER,
                    source: TrackingActionSource.DROPDOWN,
                    sourceMeta: TrackingActionSourceMeta.HAS_TASKS,
                });
            }
            return;
        }

        const definition = this.definitions.filter(
            definition => definition.property !== 'tasks',
        );
        this.$emit('update', definition);
        const type = this.$tracking.resolveTypeFromView(this.entityId);
        if (type) {
            this.$tracking.trackEventV2(type, {
                action: TrackingAction.CLEAR_FILTER,
                source: TrackingActionSource.DROPDOWN,
                sourceMeta: TrackingActionSourceMeta.HAS_TASKS,
            });
        }
    }
}
</script>
<style lang="scss" scoped>
.view-filter-controls {
    &__item {
        margin-bottom: 10px;
    }

    hr {
        margin: 10px 0 10px;
        border-color: var(--context-menu-divider-color);
    }

    &__title {
        @include font10-700;
        padding: 0 0 8px;
        color: var(--dropdown-button-text-color);
        text-transform: uppercase;
    }
}
</style>
