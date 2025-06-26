<template>
    <div class="page-list-group-by">
        Group by
        <div class="page-list-group-by__dropdown">
            <ASelect
                :items="groupingOptions"
                :value="groupBy"
                :width="150"
                :dropdown-width="150"
                check-placement="start"
                @change="changeGroupingOption"
            />
        </div>
    </div>
</template>
<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import { GroupingOptions, PageListType, SortingOptions } from '~/constants';
import ASelect from '~/components/ASelect.vue';

@Component({
    name: 'PageGroupBy',
    components: {
        ASelect,
    },
})
export default class PageGroupBy extends Vue {
    $refs!: {
        sortButton: HTMLButtonElement;
    };

    @Prop({})
    viewOptions!: any;

    @Prop({ required: true })
    entityId!: string;

    get viewType() {
        if (this.$entities.project.byId(this.entityId)) {
            return PageListType.PROJECT;
        }
        return PageListType.VIEW;
    }

    get customLabelTypes() {
        return this.$utils.pageList.getCustomLabelTypes();
    }

    get groupingOptions() {
        const options = [
            {
                id: GroupingOptions.NONE,
                label: 'No Grouping',
            },
            {
                id: GroupingOptions.PAGE_STATUS,
                label: 'Status',
            },
        ];
        if(this.viewType !== PageListType.PROJECT) {
            options.push({
                id: GroupingOptions.FOLDER,
                label: 'Folder',
            });
        }
        if(this.customLabelTypes.length !== 0) {
            this.customLabelTypes.forEach((type: any) => {
                options.push({
                    id: type,
                    label: type.charAt(0).toUpperCase() + type.replace('_', ' ').slice(1),
                })
            });
        }
        return options;
    }

    get groupBy() {
        return this.viewOptions.groupBy ?? GroupingOptions.NONE;
    }

    get sortBy() {
        return this.viewOptions.sortBy ?? SortingOptions.UPDATED_AT;
    }

    changeGroupingOption(grouping: GroupingOptions) {
        const update: any = { groupBy: grouping };

        if (grouping === GroupingOptions.PAGE_STATUS) {
            update.sortBy = SortingOptions.MANUAL;
        } else {
            update.sortBy = SortingOptions.UPDATED_AT;
        }

        this.$emit('update', update);
    }
}
</script>
<style lang="scss" scoped>
.page-list-group-by {
    @include font12-500;
    outline: none;
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--dropdown-controls-text-color);

    &__dropdown {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 4px;
    }
}
</style>
